import type { AskCitation, AskReason } from '@strict-rag/contracts';

import type { GatewayClient, ChatPurpose } from '../services/gateway/index.js';
import { GatewayError, mapGatewayFailureToAskReason } from '../services/gateway/index.js';
import {
  runRetrieve,
  type RetrieveDeps,
  type RetrieveResult,
} from '../services/retrieve/index.js';
import {
  budgetForMode,
  retrieveBudgetForMode,
  tryChargeLlm,
  tryChargeRetrieve,
  type GraphBudget,
} from './budget.js';
import {
  parseClaimSplitOutput,
  parseGenerateOutput,
  parseJudgeScores,
  parseRewriteOutput,
} from './parse.js';
import {
  claimSplitSystemPrompt,
  claimSplitUserPrompt,
  generateSystemPrompt,
  generateUserPrompt,
  judgeSystemPrompt,
  judgeUserPrompt,
  rewriteSystemPrompt,
  rewriteUserPrompt,
} from './prompts.js';
import { reasonPresentation } from './reasons.js';
import { ruleRoute } from './route-rules.js';
import {
  initState,
  type AskGraphInput,
  type AskGraphResult,
  type AskGraphState,
  type GraphEvidence,
  type SessionWindowTurn,
} from './state.js';
import { recordLlmCall } from '../obs/metrics.js';
import {
  isExplicitDocumentBackref,
  isExplicitExternalBackref,
  isExplicitSessionBackref,
  resolveBackReference,
} from '../services/ask/session-window.js';
import { noopTracer, type SpanTracer } from './tracer.js';

export type GraphChat = (
  purpose: ChatPurpose,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
) => Promise<string>;

export type GraphDeps = {
  /** 注入检索（单测 mock）；默认走 runRetrieve + retrieveDeps */
  retrieve?: (input: {
    tenantId: string;
    kbId: string;
    question: string;
    membership: AskGraphInput['membership'];
    /** 开 DEPT_ACL_ENFORCE 时算归属；缺省 = 无归属 */
    userId?: string;
    scope?: AskGraphInput['scope'];
    /** 服务端按 mode 预算；禁止客户端透传 */
    retrieveK?: number;
    rerankTopN?: number;
    preferredDocIds?: readonly string[];
  }) => Promise<RetrieveResult>;
  retrieveDeps?: RetrieveDeps;
  chat: GraphChat;
  tracer?: SpanTracer;
  /** 单测压预算；生产勿传 */
  budgetOverride?: GraphBudget;
  /** 缺省 = false。生产由 executeAsk 灌 env */
  rewriteEnabled?: boolean;
  /** 仅 rewrite 开且有 sessionId 时调用；禁跨 session */
  loadSessionWindow?: (input: {
    sessionId: string;
    kbId: string;
    userId?: string;
  }) => Promise<SessionWindowTurn[]>;
};

// ponytail: 线性状态机替代 LangGraph.js；multi_hop/CRAG 再上官方图

function finalize(
  state: AskGraphState,
  reason: AskReason,
  patch: Partial<AskGraphState> = {},
): AskGraphResult {
  const s: AskGraphState = { ...state, ...patch, reason };
  const pres = reasonPresentation(reason);
  const answered = reason === 'verified' || reason === 'chitchat';
  const status = answered ? 'answered' : 'abstained';

  let answer = s.answer ?? '';
  let userMessage = s.userMessage ?? pres.userMessage;
  if (reason === 'verified') {
    answer = s.draft ?? s.answer ?? '';
    userMessage = userMessage || answer;
  } else if (reason === 'chitchat') {
    answer = s.answer ?? chitchatReply(s.question);
    userMessage = userMessage || answer;
  } else {
    // 拒答：作废 draft 缓冲
    answer = '';
    userMessage = pres.userMessage;
  }

  return {
    requestId: s.requestId,
    status,
    answer,
    answerKind:
      reason === 'chitchat' ? 'chitchat' : status === 'answered' ? 'knowledge' : undefined,
    citations: status === 'answered' && reason === 'verified' ? s.citations : [],
    minSupport: reason === 'verified' ? s.minSupport : undefined,
    reason,
    userMessage,
    suggestedActions: s.suggestedActions.length ? s.suggestedActions : pres.suggestedActions,
    sessionId: s.sessionId,
    mode: s.mode,
    standaloneQuestion: s.standaloneQuestion,
    rewriteUsed: s.rewriteUsed,
    sessionDeepened: s.sessionDeepened,
    documentBackref: s.documentBackref,
    externalBackref: isExplicitExternalBackref(s.rawQuestion),
    backReference: resolveBackReference(s.rawQuestion),
    // 快照仅 state.evidence（retrieve 本轮）；永不含会话原文
    evidence_snapshot: s.evidence_snapshot ?? s.evidence ?? [],
    debug: {
      llmCalls: s.llmCalls,
      retrieveCalls: s.retrieveCalls,
      route_source: s.route_source,
      routeLabel: s.routeLabel,
      evidenceCount: s.evidence.length,
    },
  };
}

function chitchatReply(q: string): string {
  const n = q.trim().toLowerCase();
  if (/谢谢|thanks|thank/.test(n)) return '不客气，有制度或流程问题随时问我。';
  if (/再见|拜拜|bye/.test(n)) return '再见，祝工作顺利。';
  return '你好，我是知识库助手。请直接提问制度、流程或文档相关问题。';
}

async function chargeAndChat(
  state: AskGraphState,
  deps: GraphDeps,
  purpose: ChatPurpose,
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  maxLlm: number,
): Promise<{ ok: true; text: string; state: AskGraphState } | { ok: false; result: AskGraphResult }> {
  if (!tryChargeLlm(state.llmCalls, maxLlm, 1)) {
    return { ok: false, result: finalize(state, 'budget_exhausted') };
  }
  const next = { ...state, llmCalls: state.llmCalls + 1 };
  try {
    const text = await deps.chat(purpose, messages);
    return { ok: true, text, state: next };
  } catch (err) {
    if (err instanceof GatewayError) {
      // claim_split 失败专用 reason，禁止并入模糊 internal_guard 当主语义
      if (purpose === 'claim_split') {
        return { ok: false, result: finalize(next, 'claim_split_failed') };
      }
      return {
        ok: false,
        result: finalize(next, mapGatewayFailureToAskReason(err, 'chat')),
      };
    }
    throw err;
  }
}

/**
 * session_load → rewrite?（P2.5 最小边；默认关）。
 * 关路径不调 loader。开但未注入 loader → 空窗跳过，禁止 500。
 */
async function loadAndMaybeRewrite(
  state: AskGraphState,
  deps: GraphDeps,
  tracer: SpanTracer,
  maxLlm: number,
): Promise<{ ok: true; state: AskGraphState } | { ok: false; result: AskGraphResult }> {
  if (!(deps.rewriteEnabled === true && state.sessionId && state.mode !== 'fast')) {
    return { ok: true, state };
  }

  const sessionId = state.sessionId as string;
  let window: SessionWindowTurn[] = [];
  if (!deps.loadSessionWindow) {
    // dogfood 开但未接线：当空窗，不阻断单轮
    console.warn('[ask.rewrite] loadSessionWindow missing; skip rewrite');
  } else {
    const span = tracer.startSpan('ask.session_load', { sessionId });
    window = await deps.loadSessionWindow({
      sessionId,
      kbId: state.kbId,
      userId: state.userId,
    });
    span.end({ windowSize: window.length });
  }

  if (!window.some((t) => t.role === 'user')) {
    return { ok: true, state };
  }

  state = {
    ...state,
    sessionDeepened: isExplicitSessionBackref(state.rawQuestion),
  };

  const span = tracer.startSpan('ask.rewrite');
  const chat = await chargeAndChat(
    state,
    deps,
    'rewrite',
    [
      { role: 'system', content: rewriteSystemPrompt() },
      { role: 'user', content: rewriteUserPrompt(state.rawQuestion, window) },
    ],
    maxLlm,
  );
  if (!chat.ok) {
    span.end({ reason: chat.result.reason });
    return { ok: false, result: chat.result };
  }

  try {
    const parsed = parseRewriteOutput(chat.text);
    span.end({ rewriteUsed: true });
    return {
      ok: true,
      state: {
        ...chat.state,
        question: parsed.standalone,
        standaloneQuestion: parsed.standalone,
        rewriteUsed: true,
      },
    };
  } catch {
    span.end({ reason: 'coref_unresolved' });
    return { ok: false, result: finalize(chat.state, 'coref_unresolved') };
  }
}

/**
 * MVP 信任路径：（可选 session_load→rewrite）→ route → retrieve → generate → claim_split → verify → finalize。
 * 无 CRAG / grade / refine / multi_hop。rewrite 默认关。
 */
export async function runAskGraph(
  input: AskGraphInput,
  deps: GraphDeps,
): Promise<AskGraphResult> {
  const tracer = deps.tracer ?? noopTracer;
  const budget = deps.budgetOverride ?? budgetForMode(input.mode ?? 'balanced');
  let state = initState(input);

  const rewritten = await loadAndMaybeRewrite(state, deps, tracer, budget.maxLLMCalls);
  if (!rewritten.ok) return rewritten.result;
  state = rewritten.state;

  // --- route ---
  {
    const span = tracer.startSpan('ask.route', { questionLen: state.question.length });
    const decision = ruleRoute(state.question, state.mode);
    state = {
      ...state,
      routeLabel: decision.routeLabel,
      route_source: decision.route_source,
      route_llm_conf: decision.route_llm_conf,
      route_post_block: decision.route_post_block,
      route_llm_skipped: decision.route_llm_skipped,
    };
    span.end({ routeLabel: state.routeLabel, route_source: state.route_source });
  }

  if (state.routeLabel === 'chitchat') {
    const span = tracer.startSpan('ask.finalize', { reason: 'chitchat' });
    const result = finalize(state, 'chitchat', {
      answer: chitchatReply(state.question),
      answerKind: 'chitchat',
    });
    span.end({ status: result.status });
    return result;
  }

  // --- retrieve ---
  {
    const span = tracer.startSpan('ask.retrieve', { kbId: state.kbId });
    if (!tryChargeRetrieve(state.retrieveCalls, budget.maxRetrieveCalls)) {
      span.end({ reason: 'budget_exhausted' });
      return finalize(state, 'budget_exhausted');
    }
    state = { ...state, retrieveCalls: state.retrieveCalls + 1 };

    let r: RetrieveResult;
    const externalBackref = isExplicitExternalBackref(state.rawQuestion);
    // ponytail: 库外回溯丢掉 preferred，防测/旁路仍传入
    const preferredDocIds = externalBackref ? undefined : state.preferredDocIds;
    const retrieveBudget = retrieveBudgetForMode(state.mode);
    const retrieveInput = {
      tenantId: state.tenantId,
      kbId: state.kbId,
      question: state.question,
      membership: state.membership,
      userId: state.userId,
      scope: state.scope,
      retrieveK: retrieveBudget.retrieveK,
      rerankTopN: retrieveBudget.rerankTopN,
      preferredDocIds,
    };
    if (deps.retrieve) {
      r = await deps.retrieve(retrieveInput);
    } else if (deps.retrieveDeps) {
      r = await runRetrieve(retrieveInput, deps.retrieveDeps);
    } else {
      throw new Error('GraphDeps: retrieve or retrieveDeps required');
    }

    if (!r.ok) {
      span.end({ reason: r.reason });
      return finalize(state, r.reason);
    }

    const evidence: GraphEvidence[] = r.evidence.map((e) => ({
      chunkId: e.chunkId,
      docId: e.docId,
      title: e.title,
      text: e.text,
      preview: e.preview,
      lifecycle: e.lifecycle,
      score: e.score,
    }));
    const preferredSet = new Set(preferredDocIds ?? []);
    const adopted =
      preferredSet.size > 0 &&
      (r.meta.preferredAdopted === true ||
        (r.meta.preferredAdopted !== false &&
          r.evidence.some((e) => preferredSet.has(e.docId))));
    // 硬禁：会话历史永不进 evidence
    state = {
      ...state,
      evidence,
      evidence_snapshot: evidence,
      documentBackref:
        isExplicitDocumentBackref(state.rawQuestion) && !externalBackref && adopted,
    };
    span.end({ evidenceCount: evidence.length });
  }

  if (state.evidence.length === 0) {
    return finalize(state, 'low_retrieval');
  }

  // --- generate ---
  {
    const span = tracer.startSpan('ask.generate');
    const chat = await chargeAndChat(
      state,
      deps,
      'generate',
      [
        { role: 'system', content: generateSystemPrompt() },
        { role: 'user', content: generateUserPrompt(state.question, state.evidence) },
      ],
      budget.maxLLMCalls,
    );
    if (!chat.ok) {
      span.end({ reason: chat.result.reason });
      return chat.result;
    }
    state = chat.state;

    let parsed;
    try {
      parsed = parseGenerateOutput(chat.text);
    } catch {
      span.end({ reason: 'internal_guard' });
      return finalize(state, 'internal_guard');
    }

    if (parsed.insufficient) {
      span.end({ reason: 'model_abstained' });
      return finalize(state, 'model_abstained');
    }

    const evidenceIds = new Set(state.evidence.map((e) => e.chunkId));
    const byId = new Map(state.evidence.map((e) => [e.chunkId, e]));
    const validIds = parsed.citations.filter((id) => evidenceIds.has(id));

    if (validIds.length === 0) {
      // strip 后无合法引用 → 拒答（不静默 answered）
      span.end({ reason: 'invalid_citations' });
      return finalize(state, 'invalid_citations');
    }

    const citations: AskCitation[] = validIds.map((id) => {
      const e = byId.get(id)!;
      return {
        chunkId: e.chunkId,
        docId: e.docId,
        title: e.title,
        preview: e.preview ?? e.text.slice(0, 200),
        lifecycle: e.lifecycle,
      };
    });

    state = {
      ...state,
      draft: parsed.answer,
      citations,
    };
    span.end({ citationCount: citations.length });
  }

  // 合法 draft 必 verify — 禁止此处 answered

  // --- claim_split ---
  {
    const span = tracer.startSpan('ask.claim_split');
    const chat = await chargeAndChat(
      state,
      deps,
      'claim_split',
      [
        { role: 'system', content: claimSplitSystemPrompt() },
        {
          role: 'user',
          content: claimSplitUserPrompt(
            state.draft ?? '',
            state.citations.map((c) => c.chunkId),
            state.evidence,
          ),
        },
      ],
      budget.maxLLMCalls,
    );
    if (!chat.ok) {
      // chat 失败 → claim_split_failed（勿并入模糊 internal 当主 reason 若可区分）
      if (chat.result.reason === 'budget_exhausted') {
        span.end({ reason: 'budget_exhausted' });
        return chat.result;
      }
      span.end({ reason: 'claim_split_failed' });
      return finalize(state, 'claim_split_failed');
    }
    state = chat.state;

    try {
      const claims = parseClaimSplitOutput(chat.text);
      const evidenceIds = new Set(state.evidence.map((e) => e.chunkId));
      const citationIds = new Set(state.citations.map((c) => c.chunkId));
      for (const c of claims) {
        c.chunkIds = c.chunkIds.filter((id) => evidenceIds.has(id) && citationIds.has(id));
        if (c.chunkIds.length === 0) {
          throw new Error('claim without valid chunk');
        }
      }
      state = { ...state, claims };
      span.end({ claimCount: claims.length });
    } catch {
      span.end({ reason: 'claim_split_failed' });
      return finalize(state, 'claim_split_failed');
    }
  }

  // --- verify (batch judge + min) ---
  {
    const span = tracer.startSpan('ask.verify', { claimCount: state.claims.length });
    const chat = await chargeAndChat(
      state,
      deps,
      'judge',
      [
        { role: 'system', content: judgeSystemPrompt() },
        {
          role: 'user',
          content: judgeUserPrompt(state.claims, state.evidence),
        },
      ],
      budget.maxLLMCalls,
    );
    if (!chat.ok) {
      span.end({ reason: chat.result.reason });
      return chat.result.reason === 'budget_exhausted'
        ? chat.result
        : finalize(state, 'internal_guard');
    }
    state = chat.state;

    let scores: number[];
    try {
      scores = parseJudgeScores(chat.text, state.claims.length);
    } catch {
      // 解析失败可再 1 次
      const retry = await chargeAndChat(
        state,
        deps,
        'judge',
        [
          { role: 'system', content: judgeSystemPrompt() },
          {
            role: 'user',
            content:
              judgeUserPrompt(state.claims, state.evidence) +
              '\n\nPREVIOUS_OUTPUT_INVALID: return JSON {"scores":[...]} only.',
          },
        ],
        budget.maxLLMCalls,
      );
      if (!retry.ok) {
        span.end({ reason: retry.result.reason });
        return retry.result.reason === 'budget_exhausted'
          ? retry.result
          : finalize(state, 'unsupported_claims');
      }
      state = retry.state;
      try {
        scores = parseJudgeScores(retry.text, state.claims.length);
      } catch {
        span.end({ reason: 'unsupported_claims' });
        return finalize(state, 'unsupported_claims');
      }
    }

    // min 否决：禁止 mean 洗白
    const minSupport = Math.min(...scores);
    const allPass =
      state.claims.length > 0 && scores.every((s) => s >= state.tauClaim);
    state = { ...state, claimScores: scores, minSupport };

    if (!allPass) {
      span.end({ reason: 'unsupported_claims', minSupport });
      return finalize(state, 'unsupported_claims');
    }

    span.end({ reason: 'verified', minSupport });
  }

  // --- finalize answered ---
  {
    const span = tracer.startSpan('ask.finalize', { reason: 'verified' });
    const result = finalize(state, 'verified', {
      answer: state.draft,
      answerKind: 'knowledge',
    });
    span.end({ status: result.status });
    return result;
  }
}

/** 从 Gateway 构造 GraphChat（每次 chat 1 次计费由 run 负责） */
export function chatFromGateway(gateway: GatewayClient): GraphChat {
  return async (purpose, messages) => {
    try {
      const res = await gateway.chat({ purpose, messages });
      recordLlmCall(purpose, true);
      return res.text;
    } catch (err) {
      recordLlmCall(purpose, false);
      throw err;
    }
  };
}
