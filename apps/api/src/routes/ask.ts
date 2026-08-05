import {
  AskRequestSchema,
  AskResponseSchema,
  BizCode,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';

import { requireKbMember, type AuthVariables, type ResolveKbMember } from '../auth/middleware.js';
import { roleBypassesKbMembership } from '../auth/permissions/resolve.js';
import { childLogger } from '../logger.js';
import { fail, ok } from '../lib/response.js';
import {
  executeAsk,
  type ExecuteAskDeps,
  type ExecuteAskResult,
} from '../services/ask/index.js';
import { documentRepo } from '../services/documents.js';

export type AskRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  execute?: typeof executeAsk;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
  /** 默认 execute 的图/落库依赖 */
  executeDeps?: ExecuteAskDeps;
};

/**
 * POST /api/v1/knowledge-bases/:kbId/ask
 * 同步 JSON + SSE（Accept: text/event-stream 或 options.stream=true）。
 * 始终成员闸；route 仅编排。
 */
export function createAskRoutes(deps: AskRouteDeps = {}) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const memberMw = requireKbMember({ resolveKbMember: deps.resolveKbMember });
  const run = deps.execute ?? executeAsk;
  const getKb = deps.getKb ?? ((id: string) => documentRepo.getKb(id));

  routes.post('/knowledge-bases/:kbId/ask', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const requestId = c.get('requestId');
    const log = childLogger({ requestId, kbId });

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

    const membership = roleBypassesKbMembership(auth.roles) ? 'super_admin' : 'member';
    const tenantId = auth.tenantId ?? kb.tenantId;

    const wantStream =
      parsed.data.options?.stream === true ||
      (c.req.header('accept') ?? '').includes('text/event-stream');

    // 限流钩子位（完整限流 → observability #11）
    // rateLimitHook?.('ask', { userId: auth.userId, kbId });

    if (!wantStream) {
      const result = await run(
        {
          requestId,
          kbId,
          tenantId,
          userId: auth.userId,
          membership,
          body: parsed.data,
        },
        deps.executeDeps,
      );
      return respondAsk(c, result, log);
    }

    return streamSSE(c, async (stream) => {
      try {
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({ phase: 'running' }),
        });

        const result = await run(
          {
            requestId,
            kbId,
            tenantId,
            userId: auth.userId,
            membership,
            body: parsed.data,
          },
          deps.executeDeps,
        );

        if (result.httpStatus === 409) {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({
              code: BizCode.KB_NOT_READY,
              message: 'knowledge base has no ready and active documents',
              reason: result.response.reason,
            }),
          });
          // 仍发 final，便于客户端统一处理；同步路径则是 409 信封
          await stream.writeSSE({
            event: 'final',
            data: JSON.stringify(AskResponseSchema.parse(result.response)),
          });
          return;
        }

        // 拒答不得把未校验 token 当答案：P2 不推 token 事件，仅 final
        await stream.writeSSE({
          event: 'status',
          data: JSON.stringify({ phase: 'finalize', status: result.response.status }),
        });
        await stream.writeSSE({
          event: 'final',
          data: JSON.stringify(AskResponseSchema.parse(result.response)),
        });
      } catch (err) {
        log.error({ err }, 'ask sse failed');
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ code: BizCode.INTERNAL, message: 'ask failed' }),
        });
      }
    });
  });

  return routes;
}

function respondAsk(
  c: Parameters<typeof ok>[0],
  result: ExecuteAskResult,
  log: ReturnType<typeof childLogger>,
) {
  if (result.httpStatus === 409) {
    log.info({ reason: result.response.reason }, 'ask kb_not_ready');
    return fail(
      c,
      BizCode.KB_NOT_READY,
      'knowledge base has no ready and active documents',
      409,
      { reason: result.response.reason, requestId: result.response.requestId },
    );
  }
  const body = AskResponseSchema.parse(result.response);
  log.info(
    { status: body.status, reason: body.reason, latencyMs: body.latencyMs },
    'ask done',
  );
  return ok(c, body);
}

/** 默认生产路由 */
export const askRoutes = createAskRoutes();
