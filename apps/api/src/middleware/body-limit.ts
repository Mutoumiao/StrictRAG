import { BizCode } from '@strict-rag/contracts';
import { createMiddleware } from 'hono/factory';
import { bodyLimit } from 'hono/body-limit';

import { env } from '../env.js';
import { fail } from '../lib/response.js';
import type { ApiVariables } from './request-id.js';

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * 上传 / complete 路径 except 全局 JSON 1MiB 限制。
 * 体积闸仍走 gates/upload-size 与 complete-size。
 */
export function isBodyLimitExcept(method: string, path: string): boolean {
  const m = method.toUpperCase();
  // PUT /api/v1/internal/objects
  if (m === 'PUT' && /\/api\/v1\/internal\/objects\/?$/.test(path)) {
    return true;
  }
  // POST …/documents/:docId/complete
  if (
    m === 'POST' &&
    /\/api\/v1\/knowledge-bases\/[^/]+\/documents\/[^/]+\/complete\/?$/.test(path)
  ) {
    return true;
  }
  return false;
}

/**
 * JSON 写接口 body 上限；except 上传相关路径。
 */
export const jsonBodyLimitMiddleware = createMiddleware<{ Variables: ApiVariables }>(
  async (c, next) => {
    if (!WRITE_METHODS.has(c.req.method.toUpperCase())) {
      await next();
      return;
    }
    if (isBodyLimitExcept(c.req.method, c.req.path)) {
      await next();
      return;
    }

    const handler = bodyLimit({
      maxSize: env.API_JSON_BODY_LIMIT_BYTES,
      onError: (ctx) =>
        fail(ctx, BizCode.PAYLOAD_TOO_LARGE, '请求体超过允许大小', 413),
    });
    return handler(c, next);
  },
);
