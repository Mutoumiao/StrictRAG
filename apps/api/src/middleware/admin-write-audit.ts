import { createMiddleware } from 'hono/factory';

import { childLogger } from '../logger.js';
import type { ApiVariables } from './request-id.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 路径中的 kbId（有则带上日志上下文） */
export function extractKbIdFromPath(path: string): string | undefined {
  const m = path.match(/\/knowledge-bases\/([^/]+)/);
  return m?.[1];
}

/** 非业务写的基础设施路径（今天皆 GET；保留以防将来加写方法） */
const INFRA_PATHS = new Set(['/health', '/ready', '/metrics']);

export type AuditExclusion = {
  /** 对 `c.req.path` 判定的路径正则（无 g 标志，可重复 test） */
  pattern: RegExp;
  /** 为什么排除：PRD 依据 / 事实（PRD 无条款者必须写明「无留痕条款」） */
  reason: string;
  /**
   * 本条例外**恰好**覆盖的路由（`app.routes` 的 path 形状，含 `:param` 与挂载前缀）。
   * 反漂移测例按此断言「恰好这些」——新路由被某条例外误吞即红。
   */
  routes: string[];
};

/**
 * 管理写审计的例外表（口径 = 默认全审 + 显式例外）。
 * 判定式：`MUTATING ∧ ¬INFRA_PATHS ∧ ¬本表命中 ⇒ 审计`。
 *
 * 语义口径：管理写 = **改变 KB 治理状态或平台治理状态**的写（访问 / 内容去向 / 配置）。
 * 本表收的是「不属于治理状态」的写：身份面、高频自助写、上传暂存、内部口。
 * 依据：`docs/agents/domain.md` 与 `.trellis/spec/api/backend/logging-guidelines.md`
 * （ARCH-P1b-2）；图 `.scratch/admin-write-audit-scope/` 工单 02 裁定 R1。
 */
export const AUDIT_EXCLUSIONS: readonly AuditExclusion[] = [
  {
    pattern: /^\/api\/v1\/auth\//,
    reason: '身份面（dev-login / token 续期）；每次续期一条；沿用原口径',
    routes: [
      '/api/v1/auth/admin/dev-login',
      '/api/v1/auth/web/dev-login',
      '/api/v1/auth/admin/token/refresh',
      '/api/v1/auth/web/token/refresh',
    ],
  },
  {
    pattern: /^\/api\/v1\/knowledge-bases\/[^/]+\/ask$/,
    reason: 'ask（SSE 长连）；高频自助；沿用原口径',
    routes: ['/api/v1/knowledge-bases/:kbId/ask'],
  },
  {
    pattern: /^\/api\/v1\/ask\/[^/]+\/feedback$/,
    reason: '点赞/点踩；每次一条（高频自助）；PRD 无留痕条款',
    routes: ['/api/v1/ask/:requestId/feedback'],
  },
  {
    pattern: /^\/api\/v1\/knowledge-bases\/[^/]+\/sessions$/,
    reason: '建会话壳；每次新会话一条（最高频自助写）；PRD 无留痕条款；既有有意断言',
    routes: ['/api/v1/knowledge-bases/:kbId/sessions'],
  },
  {
    pattern: /^\/api\/v1\/knowledge-bases\/[^/]+\/documents\/upload-url$/,
    reason: '上传暂存三连之一；高频；内容提交由 documents 行自身持久留痕',
    routes: ['/api/v1/knowledge-bases/:kbId/documents/upload-url'],
  },
  {
    pattern: /^\/api\/v1\/knowledge-bases\/[^/]+\/documents\/[^/]+\/complete$/,
    reason: '上传暂存收尾；同上；PRD 无留痕条款；既有有意断言',
    routes: ['/api/v1/knowledge-bases/:kbId/documents/:docId/complete'],
  },
  {
    pattern: /^\/api\/v1\/internal\//,
    reason: '内部口（上传体中转 / eval execute-ask）；非用户令牌、批跑高频',
    routes: ['/api/v1/internal/objects', '/api/v1/internal/eval/execute-ask'],
  },
];

/** 是否命中例外表（导出供反漂移测例断言「例外表紧致」） */
export function isAuditExcluded(path: string): boolean {
  return AUDIT_EXCLUSIONS.some((e) => e.pattern.test(path));
}

/**
 * 管理写路径判定（ARCH-P1b-2；口径见 `AUDIT_EXCLUSIONS` 上方注释）。
 *
 * 判定在**路由匹配之前**（`app.ts` 里挂在 auth 之后、域路由之前），手上只有
 * method + path（`c.req.path` 带 `/api/v1` 前缀、不含 query），**拿不到**权限码 ——
 * 故口径只能落在路径上；覆盖率由结构型测例钉住（`tests/obs/admin-write-coverage.test.ts`）。
 */
export function shouldAuditAdminWrite(method: string, path: string): boolean {
  if (!MUTATING.has(method.toUpperCase())) return false;
  if (INFRA_PATHS.has(path)) return false;
  return !isAuditExcluded(path);
}

export type AdminWriteLogPayload = {
  event: 'admin_write';
  method: string;
  path: string;
  status: number;
  durationMs: number;
};

/** 纯函数：组装操作日志字段（不含 body / 字段值 / 密钥） */
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
