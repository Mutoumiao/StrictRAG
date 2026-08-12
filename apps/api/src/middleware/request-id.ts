import { createMiddleware } from 'hono/factory';
import { randomUUID } from 'node:crypto';

import type { AuthPrincipal } from '../auth/types.js';

export type ApiVariables = {
  requestId: string;
  /** attachAuth 始终写入；未登录为 null */
  auth: AuthPrincipal | null;
  effectiveCodes: Set<string>;
  /**
   * ARCH-P1b-1：请求内 KB 成员查询缓存（userId\\0kbId → boolean）。
   * 懒创建；跨请求不复用。
   */
  kbMemberCache?: Map<string, boolean>;
};

/** 生成 / 透传 requestId，写入响应头 X-Request-Id。 */
export const requestIdMiddleware = createMiddleware<{ Variables: ApiVariables }>(async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  c.set('requestId', requestId);
  // 默认未鉴权，attachAuth 再覆盖
  c.set('auth', null);
  c.set('effectiveCodes', new Set());
  c.header('X-Request-Id', requestId);
  await next();
});
