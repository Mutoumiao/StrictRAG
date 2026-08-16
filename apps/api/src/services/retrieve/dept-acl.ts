import { departmentsRepo } from '../departments.js';

/** 调用时读 process.env，便于测例 stub；env.ts 仍校验启动值。 */
export function isDeptAclEnforced(): boolean {
  return process.env.DEPT_ACL_ENFORCE === 'true';
}

export type DeptAclDoc = {
  ownerDeptId?: string | null;
  visibilityLevel?: number | null;
};

export type DeptAssignment = {
  deptId: string;
  isLeader: boolean;
};

function effectiveLevel(
  assignments: readonly DeptAssignment[],
  ownerDeptId: string | null,
): number | null {
  if (ownerDeptId == null) {
    return assignments.some((a) => a.isLeader) ? 30 : 20;
  }
  const hit = assignments.find((a) => a.deptId === ownerDeptId);
  if (!hit) return null;
  return hit.isLeader ? 30 : 20;
}

/** 精确匹配；不做祖先 / grant。enforce=false 一律可见。 */
export function isDocVisibleForDeptAcl(
  doc: DeptAclDoc,
  assignments: readonly DeptAssignment[],
  enforce: boolean,
): boolean {
  if (!enforce) return true;
  const vis = doc.visibilityLevel ?? 20;
  const eff = effectiveLevel(assignments, doc.ownerDeptId ?? null);
  return eff != null && eff >= vis;
}

export function filterDocsForDeptAcl<T extends DeptAclDoc>(
  docs: readonly T[],
  opts: { assignments: readonly DeptAssignment[]; enforce: boolean },
): T[] {
  if (!opts.enforce) return [...docs];
  return docs.filter((d) => isDocVisibleForDeptAcl(d, opts.assignments, true));
}

export function toDeptAssignments(
  rows: readonly { deptId: string; isLeader: number | boolean }[],
): DeptAssignment[] {
  return rows.map((r) => ({
    deptId: r.deptId,
    isLeader: r.isLeader === true || r.isLeader === 1,
  }));
}

/** userId / tenantId 缺 → 无归属（只见空部门）。不 5xx。 */
export async function loadDeptAssignments(
  tenantId: string | undefined,
  userId: string | undefined,
): Promise<DeptAssignment[]> {
  if (!tenantId || !userId) return [];
  const rows = await departmentsRepo.listUserDepartments(tenantId, userId);
  return toDeptAssignments(rows);
}
