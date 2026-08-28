import {
  AskRequestSchema,
  AskResponseSchema,
  BizCode,
  type AskResponse,
} from '@strict-rag/contracts';
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { Hono } from 'hono';

import { requireKbMember, type AuthVariables, type ResolveKbMember } from '../auth/middleware.js';
import { roleBypassesKbMembership } from '../auth/permissions/resolve.js';
import { childLogger } from '../logger.js';
import { fail, ok } from '../lib/response.js';
import { env } from '../env.js';
import {
  askRateLimitKey,
  checkFixedWindowRateLimit,
  recordRateLimited,
  type RateLimitResult,
} from '../obs/index.js';
import {
  executeAsk,
  type ExecuteAskDeps,
  type ExecuteAskResult,
} from '../services/ask/index.js';
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
  type KbSettingsRepo,
} from '../services/kb-settings.js';

export type AskRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  execute?: typeof executeAsk;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
  /** 默认 execute 的图/落库依赖 */
  executeDeps?: ExecuteAskDeps;
  /** 校验 session 归属（有 sessionId 时） */
  resolveOwnedSession?: ResolveOwnedSession;
  /** 限流；默认按 env.ASK_RATE_LIMIT_RPM */
  checkRateLimit?: (userId: string, kbId: string) => RateLimitResult;
  /** B2-W：读 KB 设置（mode/docTypes）；测例可注入 memory */
  settingsRepo?: KbSettingsRepo;
};
/**
 * POST /api/v1/knowledge-bases/:kbId/ask
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
  const checkLimit =
    deps.checkRateLimit ??
    ((userId: string, kbId: string) =>
      checkFixedWindowRateLimit(askRateLimitKey(userId, kbId), {
        limit: env.ASK_RATE_LIMIT_RPM,
      }));

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

    // 试点限流（ASK_RATE_LIMIT_RPM>0）
    const rl = checkLimit(auth.userId, kbId);
    if (!rl.ok) {
      recordRateLimited('ask');
      log.warn({ retryAfterSec: rl.retryAfterSec }, 'ask rate limited');
      return fail(c, BizCode.RATE_LIMITED, 'ask rate limit exceeded', 429, {
        retryAfterSec: rl.retryAfterSec,
      });
    }

    const wantStream =
      parsed.data.options?.stream === true ||
      (c.req.header('accept') ?? '').includes('text/event-stream');

    if (!wantStream) {
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
      return respondAsk(c, result, log);
    }

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          writer.write({
            type: 'data-status',
            data: { phase: 'running' },
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
