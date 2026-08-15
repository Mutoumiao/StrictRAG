import type { AskRequest, AskResponse } from '@strict-rag/contracts';
import type { EvidenceSnapshotItem } from '@strict-rag/db';

import {
  chatFromGateway,
  runAskGraph,
  type AskGraphInput,
  type AskGraphResult,
  type GraphDeps,
} from '../../graph/index.js';
import { env } from '../../env.js';
import { childLogger } from '../../logger.js';
import { createAskTracer, recordAskResult, recordL3Ask } from '../../obs/index.js';
import { getGateway, getGatewayForTenant } from '../gateway/index.js';
import { createDefaultRetrieveDeps } from '../retrieve/index.js';
import { sessionsRepo } from '../sessions.js';
import { clipSessionWindow } from './session-window.js';
import { saveAskTrace } from './traces.js';

export type ExecuteAskParams = {
  requestId: string;
  kbId: string;
  tenantId: string;
  userId: string;
  membership: AskGraphInput['membership'];
  body: AskRequest;
};

export type ExecuteAskResult = {
  /** 业务 HTTP：kb_not_ready → 409；其余 200 */
  httpStatus: 200 | 409;
  response: AskResponse;
  graph: AskGraphResult;
};

export type ExecuteAskDeps = {
  graphDeps?: GraphDeps;
  saveTrace?: typeof saveAskTrace;
  /** 跳过落库（单测） */
  skipTrace?: boolean;
  /** 跳过默认 tracer 注入（graphDeps 已自带 tracer 时） */
  skipDefaultTracer?: boolean;
};

function toEvidenceSnapshot(graph: AskGraphResult): EvidenceSnapshotItem[] {
  return (graph.evidence_snapshot ?? []).map((e) => ({
    chunkId: e.chunkId,
    docId: e.docId,
    lifecycle: e.lifecycle,
    preview: e.preview ?? e.text?.slice(0, 200),
    title: e.title,
  }));
}

function toAskResponse(
  graph: AskGraphResult,
  latencyMs: number,
  debug?: boolean,
): AskResponse {
  const base: AskResponse = {
    requestId: graph.requestId,
    status: graph.status,
    answer: graph.answer,
    answerKind: graph.answerKind,
    citations: graph.citations ?? [],
    minSupport: graph.minSupport,
    reason: graph.reason,
    userMessage: graph.userMessage,
    suggestedActions: graph.suggestedActions ?? [],
    latencyMs,
    mode: graph.mode,
    sessionId: graph.sessionId ?? null,
  };
  if (debug) {
    base.debug = {
      ...(graph.debug ?? {}),
      rewriteUsed: graph.rewriteUsed,
      sessionRewriteEnabledDefault: env.SESSION_REWRITE_ENABLED,
      ...(graph.standaloneQuestion ? { standaloneQuestion: graph.standaloneQuestion } : {}),
    };
  }
  return base;
}

/**
 * 编排：跑图 → 映射 DTO → 落 trace。
 * route 只调本函数；禁止 route 内 SQL/ES/Prompt。
 */
export async function executeAsk(
  params: ExecuteAskParams,
  deps: ExecuteAskDeps = {},
): Promise<ExecuteAskResult> {
  const started = Date.now();
  const mode = params.body.options?.mode ?? 'balanced';
  const locale = params.body.options?.locale ?? 'zh-CN';
  const log = childLogger({
    requestId: params.requestId,
    tenantId: params.tenantId,
    userId: params.userId,
    kbId: params.kbId,
    sessionId: params.body.sessionId ?? undefined,
  });

  const obs = createAskTracer({
    requestId: params.requestId,
    tenantId: params.tenantId,
    userId: params.userId,
    kbId: params.kbId,
    sessionId: params.body.sessionId,
    mode,
  });

  const graphDeps: GraphDeps = deps.graphDeps
    ? { ...deps.graphDeps }
    : await (async () => {
        // B3-W/B2-W：platform 绑定 + KB 覆盖；失败由 getGatewayForTenant 回退 env
        const gw = params.tenantId
          ? await getGatewayForTenant(params.tenantId, params.kbId)
          : getGateway();
        return {
          chat: chatFromGateway(gw),
          retrieveDeps: createDefaultRetrieveDeps(gw),
          tracer: obs.tracer,
        };
      })();

  // 注入 tracer（测例自带 graphDeps 时合并，除非 skip）
  if (!deps.skipDefaultTracer && deps.graphDeps && !deps.graphDeps.tracer) {
    graphDeps.tracer = obs.tracer;
  }

  graphDeps.rewriteEnabled ??= env.SESSION_REWRITE_ENABLED;
  if (graphDeps.rewriteEnabled && params.body.sessionId && !graphDeps.loadSessionWindow) {
    graphDeps.loadSessionWindow = async (input) => {
      const messages = await sessionsRepo.listMessages({
        sessionId: input.sessionId,
        kbId: input.kbId,
        userId: input.userId ?? params.userId,
      });
      return clipSessionWindow(messages);
    };
  }

  const graph = await runAskGraph(
    {
      requestId: params.requestId,
      question: params.body.question,
      kbId: params.kbId,
      membership: params.membership,
      userId: params.userId,
      sessionId: params.body.sessionId,
      mode,
      locale,
      scope: params.body.scope,
      tauClaim: env.TAU_CLAIM,
    },
    graphDeps,
  );

  const latencyMs = Date.now() - started;
  const response = toAskResponse(graph, latencyMs, params.body.options?.debug === true);
  const evidenceSnapshot = toEvidenceSnapshot(graph);

  // 指标 + Langfuse mock scores（拒答也完整 trace）
  recordAskResult({
    status: response.status,
    reason: response.reason,
    ok: response.status === 'answered',
  });
  recordL3Ask({
    rewriteUsed: graph.rewriteUsed,
    reason: graph.reason,
    hasSession: Boolean(params.body.sessionId),
  });
  obs.finish({
    answered: response.status === 'answered',
    min_support: response.minSupport,
    reason_code: response.reason,
    latency_ms: latencyMs,
  });

  if (!deps.skipTrace) {
    const save = deps.saveTrace ?? saveAskTrace;
    try {
      await save({
        tenantId: params.tenantId,
        kbId: params.kbId,
        userId: params.userId,
        sessionId: params.body.sessionId,
        requestId: params.requestId,
        status: response.status,
        reason: response.reason,
        minSupport: response.minSupport,
        latencyMs,
        mode: response.mode,
        rawQuestion: params.body.question,
        standaloneQuestion: graph.standaloneQuestion ?? null,
        rewriteUsed: graph.rewriteUsed,
        answer: response.answer,
        evidenceSnapshot,
        graphTrace: graph.debug
          ? {
              llmCalls: graph.debug.llmCalls,
              retrieveCalls: graph.debug.retrieveCalls,
              route_source: graph.debug.route_source,
              routeLabel: graph.debug.routeLabel,
            }
          : undefined,
        configSnap: {
          tauClaim: env.TAU_CLAIM,
          mode,
          sessionRewriteEnabledDefault: env.SESSION_REWRITE_ENABLED,
        },
      });
    } catch (err) {
      // 落库失败不阻断 200，但不得静默：warn 可观测
      log.warn({ err }, 'ask_traces save failed');
    }
  }

  log.info(
    {
      status: response.status,
      reason: response.reason,
      latencyMs,
      spanCount: obs.memory?.getRecord().spans.length,
    },
    'ask execute done',
  );

  // 空库：409 优先于 200+kb_not_ready（API 冻结）
  if (graph.reason === 'kb_not_ready') {
    return { httpStatus: 409, response, graph };
  }

  return { httpStatus: 200, response, graph };
}
