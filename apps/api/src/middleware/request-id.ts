import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';

export type ApiVariables = {
  requestId: string;
};

/** 生成 / 透传 requestId，写入响应头 X-Request-Id。 */
export const requestIdMiddleware = createMiddleware<{ Variables: ApiVariables }>(async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  c.set('requestId', requestId);
  c.header('X-Request-Id', requestId);
  await next();
});
