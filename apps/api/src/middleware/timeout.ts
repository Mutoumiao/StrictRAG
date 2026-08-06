import { BizCode } from '@strict-rag/contracts';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';
import { timeout } from 'hono/timeout';

import { env } from '../env.js';
import { buildFailureJson } from '../lib/response.js';
import type { ApiVariables } from './request-id.js';

/** POST …/knowledge-bases/:kbId/ask（含 stream）跳过全局 timeout */
export function isAskTimeoutExcept(method: string, path: string): boolean {
  if (method.toUpperCase() !== 'POST') return false;
  return /\/api\/v1\/knowledge-bases\/[^/]+\/ask\/?$/.test(path);
}

/**
 * 全局请求超时；`API_REQUEST_TIMEOUT_MS=0` 关闭。
 * ask 路径始终 skip（长生成 / SSE）。
 */
export const requestTimeoutMiddleware = createMiddleware<{ Variables: ApiVariables }>(
  async (c, next) => {
    const ms = env.API_REQUEST_TIMEOUT_MS;
    if (ms === 0) {
      await next();
      return;
    }
    if (isAskTimeoutExcept(c.req.method, c.req.path)) {
      await next();
      return;
    }

    const handler = timeout(ms, (ctx) => {
      const body = buildFailureJson(ctx, BizCode.UPSTREAM_TIMEOUT, '请求超时');
      return new HTTPException(500, {
        res: ctx.json(body, 500),
      });
    });
    return handler(c, next);
  },
);
