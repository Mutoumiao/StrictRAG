import { formatLocalDateTime } from '@strict-rag/db';

import { departmentsRepo } from '../departments.js';
import { deptGrantsRepo } from '../dept-grants.js';

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

export type DeptAclNode = { id: string; path: string };

export type DeptAclGrant = {
  deptId: string;
  maxVisibilityLevel: number;
  expiresAt?: string | null;
};

/** 空 expiresAt 未过期；本地串严格大于 now 才算仍有效。 */
export function isGrantActive(expiresAt: string | null | undefined, now: string): boolean {
  if (expiresAt == null || expiresAt === '') return true;
  return expiresAt > now;
}

function isAncestorPath(ancestorPath: string, ownerPath: string): boolean {
  return ownerPath.startsWith(ancestorPath) && ownerPath !== ancestorPath;
}

function effectiveLevel(
  assignments: readonly DeptAssignment[],
  ownerDeptId: string | null,
  depts?: readonly DeptAclNode[],
): number | null {
  if (ownerDeptId == null) {
    return assignments.some((a) => a.isLeader) ? 30 : 20;
  }
  const byId = new Map((depts ?? []).map((d) => [d.id, d]));
  const owner = byId.get(ownerDeptId);
  let max: number | null = null;
  for (const a of assignments) {
    const exact = a.deptId === ownerDeptId;
    const node = byId.get(a.deptId);
    const ancestor =
      owner != null && node != null && isAncestorPath(node.path, owner.path);
    if (!exact && !ancestor) continue;
    const lvl = a.isLeader ? 30 : 20;
    max = max == null ? lvl : Math.max(max, lvl);
  }
  return max;
}

/** grant 只精确匹配 owner 部门，不沿子树。空部门不吃 grant。 */
function grantEffectiveLevel(
  grants: readonly DeptAclGrant[] | undefined,
  ownerDeptId: string | null,
  now: string,
): number | null {
  if (ownerDeptId == null || !grants?.length) return null;
  let max: number | null = null;
  for (const g of grants) {
    if (g.deptId !== ownerDeptId) continue;
    if (!isGrantActive(g.expiresAt, now)) continue;
    max = max == null ? g.maxVisibilityLevel : Math.max(max, g.maxVisibilityLevel);
  }
  return max;
}

/** 精确 ∪ 祖先；grant 仅精确 owner 部门。enforce=false 一律可见。 */
export function isDocVisibleForDeptAcl(
  doc: DeptAclDoc,
  assignments: readonly DeptAssignment[],
  enforce: boolean,
  depts?: readonly DeptAclNode[],
  grants?: readonly DeptAclGrant[],
  now?: string,
): boolean {
  if (!enforce) return true;
  const vis = doc.visibilityLevel ?? 20;
  const ownerDeptId = doc.ownerDeptId ?? null;
  const assignEff = effectiveLevel(assignments, ownerDeptId, depts);
  const grantEff = grantEffectiveLevel(
    grants,
    ownerDeptId,
    now ?? formatLocalDateTime(),
  );
  const eff =
    assignEff == null
      ? grantEff
      : grantEff == null
        ? assignEff
        : Math.max(assignEff, grantEff);
  return eff != null && eff >= vis;
}

export function filterDocsForDeptAcl<T extends DeptAclDoc>(
  docs: readonly T[],
  opts: {
    assignments: readonly DeptAssignment[];
    enforce: boolean;
    depts?: readonly DeptAclNode[];
    grants?: readonly DeptAclGrant[];
    now?: string;
  },
): T[] {
  if (!opts.enforce) return [...docs];
  const now = opts.now ?? formatLocalDateTime();
  return docs.filter((d) =>
    isDocVisibleForDeptAcl(d, opts.assignments, true, opts.depts, opts.grants, now),
  );
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

/** tenant 缺 → 无树（只精确）。不读 grant。 */
export async function loadDeptNodes(tenantId?: string): Promise<DeptAclNode[]> {
  if (!tenantId) return [];
  const rows = await departmentsRepo.listDepartments(tenantId);
  return rows.map((r) => ({ id: r.id, path: r.path }));
}

/** 缺 tenant/user → []。丢掉跨租户部门与过期行。 */
export async function loadDeptGrants(
  tenantId?: string,
  userId?: string,
  now?: string,
): Promise<DeptAclGrant[]> {
  if (!tenantId || !userId) return [];
  const rows = await deptGrantsRepo.listGrants({ userId });
  const clock = now ?? formatLocalDateTime();
  const checked = await Promise.all(
    rows.map(async (row): Promise<DeptAclGrant | null> => {
      if (!isGrantActive(row.expiresAt, clock)) return null;
      const dept = await departmentsRepo.getDepartment(tenantId, row.deptId);
      if (!dept) return null;
      return {
        deptId: row.deptId,
        maxVisibilityLevel: row.maxVisibilityLevel,
        expiresAt: row.expiresAt,
      };
    }),
  );
  return checked.filter((g): g is DeptAclGrant => g != null);
}
