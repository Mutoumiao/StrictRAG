import { createMiddleware } from 'hono/factory';

import { childLogger } from '../logger.js';
import type { ApiVariables } from './request-id.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 路径中的 kbId（有则带上日志上下文） */
export function extractKbIdFromPath(path: string): string | undefined {
  const m = path.match(/\/knowledge-bases\/([^/]+)/);
  return m?.[1];
}

/**
 * 管理写路径判定（ARCH-P1b-2）。
 * 覆盖：成员 / 审批 / 生命周期 / 平台 admin / KB settings 写。
 * 排除：GET、ask SSE、auth、health/ready/metrics。
 */
export function shouldAuditAdminWrite(method: string, path: string): boolean {
  const m = method.toUpperCase();
  if (!MUTATING.has(m)) return false;
  if (path === '/health' || path === '/ready' || path === '/metrics') return false;
  if (path.startsWith('/api/v1/auth/')) return false;
  if (/\/knowledge-bases\/[^/]+\/ask\/?$/.test(path)) return false;

  // 成员 invite / remove
  if (/\/knowledge-bases\/[^/]+\/members(\/[^/]+)?\/?$/.test(path)) return true;
  // 审批
  if (/\/documents\/[^/]+\/(approve|reject)\/?$/.test(path)) return true;
  // 生命周期
  if (/\/documents\/[^/]+\/lifecycle\/?$/.test(path)) return true;
  // 平台管理写（users/roles/departments/model…）
  if (path.startsWith('/api/v1/admin/')) return true;
  // KB 设置写
  if (m === 'PATCH' && /\/knowledge-bases\/[^/]+\/settings\/?$/.test(path)) return true;

  return false;
}

export type AdminWriteLogPayload = {
  event: 'admin_write';
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

/** 纯函数：组装操作日志字段（不含 body / 密钥） */
export function buildAdminWritePayload(input: {
  method: string;
  path: string;
  status: number;
  durationMs: number;
}): AdminWriteLogPayload {
  return {
    event: 'admin_write',
    method: input.method.toUpperCase(),
    path: input.path,
    status: input.status,
    durationMs: input.durationMs,
  };
}

/**
 * 管理写路径操作日志（Pino 结构化，不落审计表）。
 * 挂在 auth 之后：可取 userId/tenantId；写路径在 finally 打 info（含 throw）。
 */
export const adminWriteAuditMiddleware = createMiddleware<{ Variables: ApiVariables }>(
  async (c, next) => {
    const start = Date.now();
    let threw = false;
    try {
      await next();
    } catch (err) {
      threw = true;
      throw err;
    } finally {
      if (shouldAuditAdminWrite(c.req.method, c.req.path)) {
        const auth = c.get('auth');
        // throw 时 res 可能尚未定 status；记 500 便于与 onError 对齐
        const status = threw ? (c.res.status >= 400 ? c.res.status : 500) : c.res.status;
        const payload = buildAdminWritePayload({
          method: c.req.method,
          path: c.req.path,
          status,
          durationMs: Date.now() - start,
        });
        childLogger({
          requestId: c.get('requestId'),
          userId: auth?.userId,
          tenantId: auth?.tenantId,
          kbId: extractKbIdFromPath(c.req.path),
        }).info(payload, 'admin write');
      }
    }
  },
);
