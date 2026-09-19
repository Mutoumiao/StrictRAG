import {
  AskFinalResponseSchema,
  AskModesSchema,
  AskRequestSchema,
  AskResponseSchema,
  BizCode,
  KbDocTypesSchema,
  type AskResponse,
} from '@strict-rag/contracts';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { Hono } from 'hono';

import {
  evaluateKbMember,
  requireAuth,
  requireKbMember,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { roleBypassesKbMembership } from '../auth/permissions/resolve.js';
import { childLogger } from '../logger.js';
import { fail, ok } from '../lib/response.js';
import {
  askRateLimitKey,
  askRateLimitStore,
  checkFixedWindowRateLimit,
  planeQuotas,
  recordRateLimited,
  type RateLimitResult,
} from '../obs/index.js';
import {
  executeAsk,
  getAskTraceByRequestId,
  toAskAudit,
  toAskFinal,
  type AskFinalSource,
  type AskTraceAuditSource,
  type ExecuteAskDeps,
  type ExecuteAskResult,
} from '../services/ask/index.js';
import {
  ASK_IDEM_RAW_KEY_MAX,
  askIdemKey,
  claimAskIdem,
  createIoredisAskIdemStore,
  normalizeIdempotencyKey,
  releaseAskIdem,
  type AskIdemStore,
} from '../services/ask/idempotency.js';
import { getApiRedis } from '../services/redis.js';
import {
  resolveOwnedSessionDefault,
  type ResolveOwnedSession,
} from '../services/ask/session-guard.js';
import { documentRepo } from '../services/documents.js';
import {
  assertScopeDocTypesAllowed,
  kbSettingsRepo,
  parseDocTypesFromConfig,
  parseModesFromConfig,
  resolveAskMode,
  toMemberDocTypeItems,
  type KbSettingsRepo,
} from '../services/kb-settings.js';

export type AskTraceLookup = (requestId: string) => Promise<AskTraceAuditSource | null>;
export type AskFinalLookup = (requestId: string) => Promise<AskFinalSource | null>;

export type AskRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  execute?: typeof executeAsk;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
  /** 默认 execute 的图/落库依赖 */
  executeDeps?: ExecuteAskDeps;
  /** 校验 session 归属（有 sessionId 时） */
  resolveOwnedSession?: ResolveOwnedSession;
  /** 限流；默认按 env.ASK_RATE_LIMIT_RPM（staging/production 缺配置回落安全默认，见 obs/plane-quota.ts） */
  checkRateLimit?: (userId: string, kbId: string) => RateLimitResult;
  /** B2-W：读 KB 设置（mode/docTypes）；测例可注入 memory */
  settingsRepo?: KbSettingsRepo;
  /** GET /ask/:requestId 回溯；测例可注入 */
  getTrace?: AskTraceLookup;
  /** GET /ask/:requestId/final 终态回读；测例可注入 */
  getFinal?: AskFinalLookup;
  /** PRD §2.7 铁律 6 幂等键后端；缺省走 Redis，测例注入内存实现 */
  idemStore?: AskIdemStore;
};
/**
 * POST /api/v1/knowledge-bases/:kbId/ask
 * GET  /api/v1/knowledge-bases/:kbId/ask-modes — 成员读 allowedModes/defaultMode（不含 τ）。
 * GET  /api/v1/knowledge-bases/:kbId/doc-types — 成员读类型枚举（不含 τ）。
 * GET  /api/v1/ask/:requestId — 权限回溯 evidence_snapshot + graph_trace（非断线重拉）。
 * GET  /api/v1/ask/:requestId/final — 断线重拉终态（与在线 final 同形；不可回读则 ready=false）。
 * 同步 JSON + AI SDK UI Message Stream（Accept: text/event-stream 或 options.stream=true）。
 * 始终成员闸；route 仅编排。P2 不推未校验 token，仅 data-status / data-ask-final。
 */
export function createAskRoutes(deps: AskRouteDeps = {}) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const memberMw = requireKbMember({ resolveKbMember: deps.resolveKbMember });
  const run = deps.execute ?? executeAsk;
  const getKb = deps.getKb ?? ((id: string) => documentRepo.getKb(id));
  const settings = deps.settingsRepo ?? kbSettingsRepo;
  const resolveSession = deps.resolveOwnedSession ?? resolveOwnedSessionDefault;
  const getTrace: AskTraceLookup =
    deps.getTrace ??
    (async (requestId) => {
      const t = await getAskTraceByRequestId(requestId);
      if (!t) return null;
      return {
        requestId: t.requestId,
        kbId: t.kbId,
        status: t.status,
        reason: t.reason,
        mode: t.mode,
        latencyMs: t.latencyMs,
        sessionId: t.sessionId,
        evidenceSnapshot: t.evidenceSnapshot ?? [],
        graphTrace: t.graphTrace ?? null,
      };
    });
  const getFinal: AskFinalLookup =
    deps.getFinal ??
    (async (requestId) => {
      const t = await getAskTraceByRequestId(requestId);
      if (!t) return null;
      return {
        requestId: t.requestId,
        kbId: t.kbId,
        status: t.status,
        reason: t.reason,
        minSupport: t.minSupport,
        latencyMs: t.latencyMs,
        mode: t.mode,
        sessionId: t.sessionId,
        answer: t.answer,
        citations: t.citations ?? null,
      };
    });
  const checkLimit =
    deps.checkRateLimit ??
    ((userId: string, kbId: string) =>
      checkFixedWindowRateLimit(askRateLimitKey(userId, kbId), {
        limit: planeQuotas.ask.rpm,
        store: askRateLimitStore,
      }));

  // 幂等键后端懒建：不带 Idempotency-Key 的请求永不触碰 Redis
  let idemStore = deps.idemStore;
  const resolveIdemStore = (): AskIdemStore => {
    idemStore ??= createIoredisAskIdemStore(getApiRedis());
    return idemStore;
  };

  /**
   * 幂等命中（PRD §2.7 铁律 6）：已 finalize → 复用同一 requestId 的终态 DTO（与在线同形）；
   * 在途 / 终态不可同形 → 409，**不**开第二条并行图。
   */
  async function idemReplay(
    c: Parameters<typeof ok>[0],
    input: { prevRequestId: string; wantStream: boolean; log: ReturnType<typeof childLogger> },
  ) {
    const { prevRequestId, wantStream, log } = input;
    const trace = await getFinal(prevRequestId);
    if (!trace) {
      log.info({ idem: 'in_flight', requestId: prevRequestId }, 'ask idempotency hit (in flight)');
      return fail(c, BizCode.CONFLICT, 'ask request in flight', 409, {
        requestId: prevRequestId,
        status: 'in_flight',
      });
    }
    const finalBody = AskFinalResponseSchema.parse(toAskFinal(trace));
    if (!finalBody.ready) {
      log.info(
        { idem: 'not_replayable', requestId: prevRequestId },
        'ask idempotency hit (final not replayable)',
      );
      return fail(c, BizCode.CONFLICT, 'ask final not replayable', 409, {
        requestId: prevRequestId,
        status: 'not_replayable',
      });
    }
    log.info({ idem: 'replay', requestId: prevRequestId }, 'ask idempotency hit (replay)');
    if (!wantStream) return ok(c, finalBody.response);

    const replay = createUIMessageStream({
      execute: async ({ writer }) => {
        writer.write({
          type: 'data-status',
          data: { phase: 'running', requestId: prevRequestId },
          transient: true,
        });
        writer.write({
          type: 'data-status',
          data: { phase: 'finalize', status: finalBody.response.status },
          transient: true,
        });
        writer.write({ type: 'data-ask-final', id: 'ask-final', data: finalBody.response });
      },
      onError: () => 'ask failed',
    });
    return createUIMessageStreamResponse({ stream: replay });
  }

  /** GET /knowledge-bases/:kbId/ask-modes — 成员可读档位；禁止经此口暴露 τ */
  routes.get('/knowledge-bases/:kbId/ask-modes', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    let settingsRow: Awaited<ReturnType<KbSettingsRepo['get']>> = null;
    try {
      settingsRow = await settings.get(kbId);
    } catch {
      settingsRow = null;
    }
    const modes = parseModesFromConfig(settingsRow?.configJson ?? {});
    return ok(c, AskModesSchema.parse(modes));
  });

  /** GET /knowledge-bases/:kbId/doc-types — 成员可读枚举；禁止经此口暴露 τ */
  routes.get('/knowledge-bases/:kbId/doc-types', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    let settingsRow: Awaited<ReturnType<KbSettingsRepo['get']>> = null;
    try {
      settingsRow = await settings.get(kbId);
    } catch {
      settingsRow = null;
    }
    const items = toMemberDocTypeItems(settingsRow?.configJson ?? {});
    return ok(c, KbDocTypesSchema.parse({ items }));
  });

  routes.post('/knowledge-bases/:kbId/ask', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const requestId = c.get('requestId');

    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid json body', 400);
    }

    const parsed = AskRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid ask body', 400, parsed.error.flatten());
    }

    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    // B2-W：allowedModes / defaultMode / docTypes 闸
    // 读库失败 → 全量默认（不阻断 ask；测例无 PG 时同）
    let settingsRow: Awaited<ReturnType<KbSettingsRepo['get']>> = null;
    try {
      settingsRow = await settings.get(kbId);
    } catch {
      settingsRow = null;
    }
    const modes = parseModesFromConfig(settingsRow?.configJson ?? {});
    const modeGate = resolveAskMode({
      requested: parsed.data.options?.mode,
      allowedModes: modes.allowedModes,
      defaultMode: modes.defaultMode,
    });
    if (!modeGate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, modeGate.message, 400);
    }
    const kbDocTypes = parseDocTypesFromConfig(settingsRow?.configJson ?? {});
    const docTypeGate = assertScopeDocTypesAllowed({
      scopeDocTypes: parsed.data.scope?.docTypes,
      kbDocTypes,
    });
    if (!docTypeGate.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, docTypeGate.message, 400, {
        invalid: docTypeGate.invalid,
      });
    }

    const askBody = {
      ...parsed.data,
      options: {
        ...parsed.data.options,
        mode: modeGate.mode,
      },
    };

    // 有 sessionId：须存在且本人本 KB；不跑 rewrite（P2）
    const sessionId = askBody.sessionId ?? null;
    if (sessionId) {
      const owned = await resolveSession({
        sessionId,
        kbId,
        userId: auth.userId,
      });
      if (!owned) {
        return fail(c, BizCode.NOT_FOUND, 'session not found', 404, { sessionId });
      }
    }

    const membership = roleBypassesKbMembership(auth.roles) ? 'super_admin' : 'member';
    const tenantId = auth.tenantId ?? kb.tenantId;
    const log = childLogger({
      requestId,
      kbId,
      userId: auth.userId,
      tenantId,
      sessionId: sessionId ?? undefined,
    });

    // 试点限流（ASK_RATE_LIMIT_RPM>0）；触顶不得 200 空答
    // 幂等短路在限流**之前**：同 key 重试不消耗配额（PRD 未写，本仓口径）。
    const wantStream =
      parsed.data.options?.stream === true ||
      (c.req.header('accept') ?? '').includes('text/event-stream');
    const rawIdemKey = normalizeIdempotencyKey(c.req.header('idempotency-key'));
    if (rawIdemKey && rawIdemKey.length > ASK_IDEM_RAW_KEY_MAX) {
      return fail(c, BizCode.VALIDATION_ERROR, 'idempotency key too long', 400, {
        max: ASK_IDEM_RAW_KEY_MAX,
      });
    }
    const idemKey = rawIdemKey
      ? askIdemKey({ tenantId, userId: auth.userId, kbId, rawKey: rawIdemKey })
      : null;
    if (idemKey) {
      const claim = await claimAskIdem(resolveIdemStore(), idemKey, requestId);
      if (claim.status === 'reuse') {
        return idemReplay(c, { prevRequestId: claim.requestId, wantStream, log });
      }
    }

    const rl = checkLimit(auth.userId, kbId);
    if (!rl.ok) {
      recordRateLimited('ask', 'ask');
      log.warn({ retryAfterSec: rl.retryAfterSec, plane: 'ask' }, 'ask rate limited');
      return fail(c, BizCode.RATE_LIMITED, 'ask rate limit exceeded', 429, {
        retryAfterSec: rl.retryAfterSec,
        plane: 'ask',
        ask_quota_exhausted: true,
      });
    }

    if (!wantStream) {
      let result: ExecuteAskResult;
      try {
        result = await run(
          {
            requestId,
            kbId,
            tenantId,
            userId: auth.userId,
            membership,
            body: askBody,
          },
          deps.executeDeps,
        );
      } catch (err) {
        // 终态未落库 → 释放 claim，允许同 key 重试（不得留 10m 假「在途」）
        if (idemKey) await releaseAskIdem(resolveIdemStore(), idemKey).catch(() => undefined);
        throw err;
      }
      return respondAsk(c, result, log);
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          writer.write({
            type: 'data-status',
            data: { phase: 'running', requestId },
            transient: true,
          });

          const result = await run(
            {
              requestId,
              kbId,
              tenantId,
              userId: auth.userId,
              membership,
              body: askBody,
            },
            deps.executeDeps,
          );

          const finalBody = AskResponseSchema.parse(result.response);

          // 拒答不得把未校验 token 当答案：P2 不推 text-delta 伪流式，仅 data-ask-final
          writer.write({
            type: 'data-status',
            data: { phase: 'finalize', status: finalBody.status },
            transient: true,
          });
          writer.write({
            type: 'data-ask-final',
            id: 'ask-final',
            data: finalBody,
          });

          log.info(
            { status: finalBody.status, reason: finalBody.reason, latencyMs: finalBody.latencyMs },
            'ask stream done',
          );
        } catch (err) {
          log.error({ err }, 'ask stream failed');
          // 终态未落库 → 释放 claim，允许同 key 重试（不得留 10m 假「在途」）
          if (idemKey) await releaseAskIdem(resolveIdemStore(), idemKey).catch(() => undefined);
          writer.write({
            type: 'data-status',
            data: { phase: 'error', code: BizCode.INTERNAL, message: 'ask failed' },
            transient: true,
          });
          // 必须有终态 part，避免客户端只订阅 final 时卡在 loading
          writer.write({
            type: 'data-ask-final',
            id: 'ask-final',
            data: AskResponseSchema.parse({
              requestId,
              status: 'abstained',
              answer: '',
              reason: 'internal_guard',
              citations: [],
              suggestedActions: [],
              userMessage: '服务暂时不可用，请稍后重试',
            }),
          });
        }
      },
      onError: () => 'ask failed',
    });

    return createUIMessageStreamResponse({ stream });
  });

  /** GET /ask/:requestId — 登录 + 该 trace 的 KB 成员；快照不依赖现网分片 */
  routes.get('/ask/:requestId', requireAuth(), async (c) => {
    const requestId = c.req.param('requestId');
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const trace = await getTrace(requestId);
    if (!trace) {
      return fail(c, BizCode.NOT_FOUND, 'ask trace not found', 404, { requestId });
    }

    const memberR = await evaluateKbMember(c, trace.kbId, {
      resolveKbMember: deps.resolveKbMember,
    });
    if (!memberR.ok) {
      return fail(
        c,
        memberR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        memberR.message,
        memberR.status,
        'details' in memberR ? memberR.details : undefined,
      );
    }

    return ok(c, toAskAudit(trace));
  });

  /**
   * GET /ask/:requestId/final — 断线重拉终态（≠ 审计口 §2.9）。
   * 成员闸同审计口；无 trace 404；有 trace 但终态不可同形回读时回 `ready:false`，不编造 answered。
   */
  routes.get('/ask/:requestId/final', requireAuth(), async (c) => {
    const requestId = c.req.param('requestId');
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const trace = await getFinal(requestId);
    if (!trace) {
      return fail(c, BizCode.NOT_FOUND, 'ask trace not found', 404, { requestId });
    }

    const memberR = await evaluateKbMember(c, trace.kbId, {
      resolveKbMember: deps.resolveKbMember,
    });
    if (!memberR.ok) {
      return fail(
        c,
        memberR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        memberR.message,
        memberR.status,
        'details' in memberR ? memberR.details : undefined,
      );
    }

    return ok(c, AskFinalResponseSchema.parse(toAskFinal(trace)));
  });

  return routes;
}

function respondAsk(
  c: Parameters<typeof ok>[0],
  result: ExecuteAskResult,
  log: ReturnType<typeof childLogger>,
) {
  const body: AskResponse = AskResponseSchema.parse(result.response);
  log.info(
    { status: body.status, reason: body.reason, latencyMs: body.latencyMs },
    'ask done',
  );
  return ok(c, body);
}

/** 默认生产路由 */
export const askRoutes = createAskRoutes();
