import type { Context } from 'hono';

import { BizCode } from '@strict-rag/contracts';

import { fail } from '../lib/response.js';
import {
  evaluateKbMember,
  isAuthEnforceEnabled,
  type AuthVariables,
  type ResolveKbMember,
} from './middleware.js';

/**
 * 文档级 KB 成员闸（读写共用，handler 级）。
 *
 * 路径只有 `:docId`（无 `:kbId`）的文档入口，中间件拿不到库作用域 —— `checkPermission` 只
 * 从 path 取 `:kbId`（`auth/middleware.ts`），故须由 handler 取到 `doc.kbId` 后补这道闸。
 * 依据：ADR-035 §决策 4「无 kb_members 行 → 该 KB 一切内容路径 403（ask、读文档内容/列表、
 * 上传、删文档…）」；ADR-045 焊死 #1「各 API handler 仍校验，中间件漏了也不放行写」。
 *
 * 姿态**随该入口的权限码**（唯一口径，不另议）：
 * - `requirePermission`（始终验码）→ `'always'`：始终查成员；
 * - `requirePermissionWhenEnforced` → `'whenEnforced'`：随 `AUTH_ENFORCE`（关则不查，
 *   以免把 dev / demo 的无认证读路径打成 401，即不翻转仓库默认）。
 *
 * 顺序：本闸是**外层**，先于部门 / `aclPrincipals` 第二层闸。
 * super_admin 旁路（`roleBypassesKbMembership`，内建在 `evaluateKbMember`）；通过返回 null。
 */
export type DocGatePosture = 'always' | 'whenEnforced';

export type DocScopeDeps = {
  /** 成员解析；默认查 kb_members，测例注入内存实现 */
  resolveKbMember?: ResolveKbMember;
};

export type DocMemberGate = (
  c: Context<{ Variables: AuthVariables }>,
  kbId: string,
  posture: DocGatePosture,
) => Promise<Response | null>;

export function createDocMemberGate(deps: DocScopeDeps = {}): DocMemberGate {
  return async function docMemberDenied(c, kbId, posture) {
    if (posture === 'whenEnforced' && !isAuthEnforceEnabled()) return null;
    const r = await evaluateKbMember(c, kbId, { resolveKbMember: deps.resolveKbMember });
    if (r.ok) return null;
    return fail(
      c,
      r.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
      r.message,
      r.status,
      'details' in r ? r.details : undefined,
    );
  };
}
