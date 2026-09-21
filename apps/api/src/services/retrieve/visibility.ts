import { formatLocalDateTime } from '@strict-rag/db';

import {
  isDocVisibleForDeptAcl,
  loadDeptAssignments,
  loadDeptGrants,
  loadDeptNodes,
  type DeptAclDoc,
  type DeptAclGrant,
  type DeptAclNode,
  type DeptAssignment,
} from './dept-acl.js';
import { isDocVisibleForAclPrincipals, type AclPrincipalDoc } from './doc-acl.js';

/**
 * ADR-057「列表预览、chunk 查看、ask evidence 同一可见性函数」的唯一定义处。
 * 收敛的只是「部门 + 名单」的组合方式；各入口的输入来源（tenantId / bypass 通道）
 * 与输出形态（集合 / bool / 403 文案）仍由调用方决定。
 */

export type VisibilitySubject = {
  /** 请求权威租户；缺省走文档行（fail-closed 方向） */
  tenantId: string | undefined;
  userId?: string | undefined;
  /** 超管旁路（`roleBypassesKbMembership`）；检索层读 membership 槽，跑批可压低 */
  bypass: boolean;
};

export type VisibilityContext = {
  enforce: boolean;
  inheritDown: boolean;
  now: string;
  assignments: readonly DeptAssignment[];
  depts: readonly DeptAclNode[];
  grants: readonly DeptAclGrant[];
};

export type VisibilityDecision = { ok: true } | { ok: false; reason: 'dept' | 'principals' };

export type VisibilityDoc = DeptAclDoc & AclPrincipalDoc;

/**
 * 全仓唯一的「归属 + 部门树 + grant」三连加载处。
 * `!enforce || bypass` 时短路为空 ctx：既不查库，判定也退化为「名单闸独担」
 * （`isDocVisibleForDeptAcl` 对 `!enforce` / `bypass` 直接放行）。
 */
export async function loadVisibilityContext(input: {
  subject: VisibilitySubject;
  enforce: boolean;
  inheritDown: boolean;
  now?: string;
}): Promise<VisibilityContext> {
  const { subject, enforce, inheritDown } = input;
  const now = input.now ?? formatLocalDateTime();
  if (!enforce || subject.bypass) {
    return { enforce, inheritDown, now, assignments: [], depts: [], grants: [] };
  }
  const [assignments, depts, grants] = await Promise.all([
    loadDeptAssignments(subject.tenantId, subject.userId),
    loadDeptNodes(subject.tenantId),
    loadDeptGrants(subject.tenantId, subject.userId),
  ]);
  return { enforce, inheritDown, now, assignments, depts, grants };
}

/** 部门 → 名单（顺序固定；`reason` 供调用方映射 403 文案）。成员闸在函数外。 */
export function isDocVisible(
  doc: VisibilityDoc,
  subject: VisibilitySubject,
  ctx: VisibilityContext,
): VisibilityDecision {
  const deptOk = isDocVisibleForDeptAcl(
    doc,
    ctx.assignments,
    ctx.enforce,
    ctx.depts,
    ctx.grants,
    ctx.now,
    subject.bypass,
    ctx.inheritDown,
  );
  if (!deptOk) return { ok: false, reason: 'dept' };
  const principalsOk = isDocVisibleForAclPrincipals(doc, {
    userId: subject.userId,
    bypass: subject.bypass,
  });
  if (!principalsOk) return { ok: false, reason: 'principals' };
  return { ok: true };
}

export function filterVisibleDocs<T extends VisibilityDoc>(
  docs: readonly T[],
  subject: VisibilitySubject,
  ctx: VisibilityContext,
): T[] {
  return docs.filter((d) => isDocVisible(d, subject, ctx).ok);
}
