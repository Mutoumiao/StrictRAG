import type {
  CreateDepartmentBody,
  Department,
  DepartmentStatus,
  DepartmentTreeNode,
  PatchDepartmentBody,
  PutUserDepartmentsBody,
  UserDepartmentAssignment,
  UserDepartmentsView,
} from '@strict-rag/contracts';
import { departments, formatLocalDateTime, userDepartments, users } from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';
import { DEV_DEFAULT_TENANT } from './members.js';

export type DeptRow = {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  path: string;
  sort: number;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type UserDeptRow = {
  id: string;
  tenantId: string;
  userId: string;
  deptId: string;
  isPrimary: number;
  isLeader: number;
  title: string | null;
};

export type DepartmentsRepo = {
  listDepartments(tenantId: string): Promise<DeptRow[]>;
  getDepartment(tenantId: string, id: string): Promise<DeptRow | null>;
  createDepartment(
    tenantId: string,
    input: {
      parentId: string | null;
      name: string;
      code: string | null;
      path: string;
      sort: number;
      status: string;
      createdBy?: string;
    },
  ): Promise<DeptRow>;
  updateDepartment(
    tenantId: string,
    id: string,
    patch: Partial<{
      parentId: string | null;
      name: string;
      code: string | null;
      path: string;
      sort: number;
      status: string;
      updatedBy: string;
    }>,
  ): Promise<DeptRow | null>;
  /** 批量更新 path（父迁移后重算子树） */
  updatePaths(
    tenantId: string,
    updates: Array<{ id: string; path: string }>,
  ): Promise<void>;
  deleteDepartment(tenantId: string, id: string): Promise<boolean>;
  countChildren(tenantId: string, parentId: string): Promise<number>;
  countUserAssignments(tenantId: string, deptId: string): Promise<number>;
  listUserDepartments(tenantId: string, userId: string): Promise<UserDeptRow[]>;
  setUserDepartments(
    tenantId: string,
    userId: string,
    rows: Array<{
      deptId: string;
      isPrimary: number;
      isLeader: number;
      title: string | null;
    }>,
    updatedBy?: string,
  ): Promise<void>;
  userExists(tenantId: string, userId: string): Promise<boolean>;
};

export function resolveTenantId(tenantId?: string | null): string {
  return tenantId ?? DEV_DEFAULT_TENANT;
}

export function toPublicDepartment(row: DeptRow): Department {
  return {
    id: row.id,
    parentId: row.parentId,
    name: row.name,
    code: row.code,
    sort: row.sort,
    status: (row.status === 'disabled' ? 'disabled' : 'active') as DepartmentStatus,
    path: row.path,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** path 形如 /uuid/ 或 /uuid/uuid/ */
export function pathFor(parentPath: string | null | undefined, id: string): string {
  if (!parentPath || parentPath === '/') return `/${id}/`;
  const base = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
  return `${base}${id}/`;
}

/**
 * 若把 deptId 的父改为 newParentId，是否成环。
 * newParentId 为 null → 不成环。
 */
export function wouldCreateCycle(
  deptId: string,
  newParentId: string | null,
  byId: Map<string, DeptRow>,
): boolean {
  if (!newParentId) return false;
  if (newParentId === deptId) return true;
  let cur: string | null = newParentId;
  const guard = new Set<string>();
  while (cur) {
    if (cur === deptId) return true;
    if (guard.has(cur)) return true;
    guard.add(cur);
    cur = byId.get(cur)?.parentId ?? null;
  }
  return false;
}

export function buildDepartmentTree(rows: DeptRow[]): DepartmentTreeNode[] {
  const nodes = new Map<string, DepartmentTreeNode>();
  for (const r of rows) {
    nodes.set(r.id, { ...toPublicDepartment(r), children: [] });
  }
  const roots: DepartmentTreeNode[] = [];
  for (const r of rows) {
    const node = nodes.get(r.id)!;
    if (r.parentId && nodes.has(r.parentId)) {
      nodes.get(r.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (list: DepartmentTreeNode[]) => {
    list.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  return roots;
}

/**
 * 校验归属列表：
 * - 有归属时恰好 1 个 primary
 * - deptId 不重复
 */
export function validateAssignmentList(
  assignments: PutUserDepartmentsBody['assignments'],
): { ok: true } | { ok: false; message: string } {
  if (assignments.length === 0) return { ok: true };
  const primary = assignments.filter((a) => a.isPrimary);
  if (primary.length !== 1) {
    return { ok: false, message: 'exactly one primary department required when assignments non-empty' };
  }
  const ids = assignments.map((a) => a.deptId);
  if (new Set(ids).size !== ids.length) {
    return { ok: false, message: 'duplicate deptId in assignments' };
  }
  return { ok: true };
}

export function toUserDepartmentsView(
  userId: string,
  rows: UserDeptRow[],
  deptsById: Map<string, DeptRow>,
): UserDepartmentsView {
  const assignments: UserDepartmentAssignment[] = rows.map((r) => ({
    deptId: r.deptId,
    isPrimary: r.isPrimary === 1,
    isLeader: r.isLeader === 1,
    title: r.title,
    deptName: deptsById.get(r.deptId)?.name,
  }));
  // 主部门在前
  assignments.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return { userId, assignments };
}

export function applyCreateBody(body: CreateDepartmentBody): {
  name: string;
  parentId: string | null;
  code: string | null;
  sort: number;
} {
  return {
    name: body.name.trim(),
    parentId: body.parentId ?? null,
    code: body.code === undefined || body.code === null || body.code === '' ? null : body.code,
    sort: body.sort ?? 0,
  };
}

export function applyPatchBody(
  cur: DeptRow,
  body: PatchDepartmentBody,
): {
  name: string;
  parentId: string | null;
  code: string | null;
  sort: number;
  status: string;
  parentChanged: boolean;
} {
  const parentId =
    body.parentId !== undefined ? body.parentId : cur.parentId;
  return {
    name: body.name !== undefined ? body.name.trim() : cur.name,
    parentId,
    code:
      body.code !== undefined
        ? body.code === null || body.code === ''
          ? null
          : body.code
        : cur.code,
    sort: body.sort ?? cur.sort,
    status: body.status ?? cur.status,
    parentChanged: body.parentId !== undefined && body.parentId !== cur.parentId,
  };
}

/** 父迁移后重算本节点及子孙 path */
export function recomputeSubtreePaths(
  rootId: string,
  newRootPath: string,
  byId: Map<string, DeptRow>,
): Array<{ id: string; path: string }> {
  const updates: Array<{ id: string; path: string }> = [{ id: rootId, path: newRootPath }];
  const childrenOf = (pid: string) =>
    [...byId.values()].filter((d) => d.parentId === pid).map((d) => d.id);

  const walk = (id: string, path: string) => {
    for (const cid of childrenOf(id)) {
      const cpath = pathFor(path, cid);
      updates.push({ id: cid, path: cpath });
      walk(cid, cpath);
    }
  };
  walk(rootId, newRootPath);
  return updates;
}

export function createMemoryDepartmentsRepo(opts?: {
  /** 预置已知用户（测 PUT 归属） */
  knownUsers?: Array<{ tenantId: string; userId: string }>;
}): DepartmentsRepo {
  const depts = new Map<string, DeptRow>();
  const userDepts = new Map<string, UserDeptRow[]>(); // key=userId
  const knownUsers = new Set(
    (opts?.knownUsers ?? []).map((u) => `${u.tenantId}:${u.userId}`),
  );

  const repo: DepartmentsRepo = {
    async listDepartments(tenantId) {
      return [...depts.values()]
        .filter((d) => d.tenantId === tenantId)
        .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
    },
    async getDepartment(tenantId, id) {
      const d = depts.get(id);
      return d && d.tenantId === tenantId ? d : null;
    },
    async createDepartment(tenantId, input) {
      const id = uuidv7();
      const parentPath = input.parentId ? (depts.get(input.parentId)?.path ?? null) : null;
      const row: DeptRow = {
        id,
        tenantId,
        parentId: input.parentId,
        name: input.name,
        code: input.code,
        path: pathFor(parentPath, id),
        sort: input.sort,
        status: input.status,
        createdAt: formatLocalDateTime(),
        updatedAt: formatLocalDateTime(),
      };
      depts.set(row.id, row);
      return row;
    },
    async updateDepartment(tenantId, id, patch) {
      const cur = await repo.getDepartment(tenantId, id);
      if (!cur) return null;
      const next: DeptRow = {
        ...cur,
        parentId: patch.parentId !== undefined ? patch.parentId : cur.parentId,
        name: patch.name ?? cur.name,
        code: patch.code !== undefined ? patch.code : cur.code,
        path: patch.path ?? cur.path,
        sort: patch.sort ?? cur.sort,
        status: patch.status ?? cur.status,
        updatedAt: formatLocalDateTime(),
      };
      depts.set(id, next);
      return next;
    },
    async updatePaths(tenantId, updates) {
      for (const u of updates) {
        const cur = depts.get(u.id);
        if (cur && cur.tenantId === tenantId) {
          depts.set(u.id, { ...cur, path: u.path, updatedAt: formatLocalDateTime() });
        }
      }
    },
    async deleteDepartment(tenantId, id) {
      const cur = await repo.getDepartment(tenantId, id);
      if (!cur) return false;
      depts.delete(id);
      return true;
    },
    async countChildren(tenantId, parentId) {
      return [...depts.values()].filter(
        (d) => d.tenantId === tenantId && d.parentId === parentId,
      ).length;
    },
    async countUserAssignments(tenantId, deptId) {
      let n = 0;
      for (const rows of userDepts.values()) {
        n += rows.filter((r) => r.tenantId === tenantId && r.deptId === deptId).length;
      }
      return n;
    },
    async listUserDepartments(tenantId, userId) {
      return (userDepts.get(userId) ?? []).filter((r) => r.tenantId === tenantId);
    },
    async setUserDepartments(tenantId, userId, rows) {
      userDepts.set(
        userId,
        rows.map((r) => ({
          id: uuidv7(),
          tenantId,
          userId,
          deptId: r.deptId,
          isPrimary: r.isPrimary,
          isLeader: r.isLeader,
          title: r.title,
        })),
      );
    },
    async userExists(tenantId, userId) {
      return knownUsers.has(`${tenantId}:${userId}`);
    },
  };

  /** 测试辅助：注册用户 */
  (repo as DepartmentsRepo & { registerUser: (t: string, u: string) => void }).registerUser = (
    tenantId,
    userId,
  ) => {
    knownUsers.add(`${tenantId}:${userId}`);
  };

  return repo;
}

export type MemoryDepartmentsRepo = DepartmentsRepo & {
  registerUser(tenantId: string, userId: string): void;
};

export function createMemoryDepartmentsRepoWithUsers(): MemoryDepartmentsRepo {
  return createMemoryDepartmentsRepo() as MemoryDepartmentsRepo;
}

/** 生产 Drizzle 实现 */
export const departmentsRepo: DepartmentsRepo = {
  async listDepartments(tenantId) {
    const rows = await getDb()
      .select()
      .from(departments)
      .where(eq(departments.tenantId, tenantId));
    return rows.map(mapDeptRow);
  },

  async getDepartment(tenantId, id) {
    const [r] = await getDb()
      .select()
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.id, id)))
      .limit(1);
    return r ? mapDeptRow(r) : null;
  },

  async createDepartment(tenantId, input) {
    const id = uuidv7();
    const path = pathFor(
      input.parentId
        ? (await this.getDepartment(tenantId, input.parentId))?.path
        : null,
      id,
    );
    await getDb().insert(departments).values({
      id,
      tenantId,
      parentId: input.parentId,
      name: input.name,
      code: input.code,
      path,
      sort: input.sort,
      status: input.status,
      createdBy: input.createdBy,
    });
    const row = await this.getDepartment(tenantId, id);
    if (!row) throw new Error('department insert failed');
    return row;
  },

  async updateDepartment(tenantId, id, patch) {
    const sets: Record<string, unknown> = { updatedAt: formatLocalDateTime() };
    if (patch.parentId !== undefined) sets.parentId = patch.parentId;
    if (patch.name !== undefined) sets.name = patch.name;
    if (patch.code !== undefined) sets.code = patch.code;
    if (patch.path !== undefined) sets.path = patch.path;
    if (patch.sort !== undefined) sets.sort = patch.sort;
    if (patch.status !== undefined) sets.status = patch.status;
    if (patch.updatedBy !== undefined) sets.updatedBy = patch.updatedBy;
    await getDb()
      .update(departments)
      .set(sets)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.id, id)));
    return this.getDepartment(tenantId, id);
  },

  async updatePaths(tenantId, updates) {
    for (const u of updates) {
      await getDb()
        .update(departments)
        .set({ path: u.path, updatedAt: formatLocalDateTime() })
        .where(and(eq(departments.tenantId, tenantId), eq(departments.id, u.id)));
    }
  },

  async deleteDepartment(tenantId, id) {
    const res = await getDb()
      .delete(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.id, id)))
      .returning({ id: departments.id });
    return res.length > 0;
  },

  async countChildren(tenantId, parentId) {
    const rows = await getDb()
      .select({ id: departments.id })
      .from(departments)
      .where(and(eq(departments.tenantId, tenantId), eq(departments.parentId, parentId)));
    return rows.length;
  },

  async countUserAssignments(tenantId, deptId) {
    const rows = await getDb()
      .select({ id: userDepartments.id })
      .from(userDepartments)
      .where(
        and(eq(userDepartments.tenantId, tenantId), eq(userDepartments.deptId, deptId)),
      );
    return rows.length;
  },

  async listUserDepartments(tenantId, userId) {
    const rows = await getDb()
      .select()
      .from(userDepartments)
      .where(
        and(eq(userDepartments.tenantId, tenantId), eq(userDepartments.userId, userId)),
      );
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      userId: r.userId,
      deptId: r.deptId,
      isPrimary: r.isPrimary,
      isLeader: r.isLeader,
      title: r.title ?? null,
    }));
  },

  async setUserDepartments(tenantId, userId, rows, updatedBy) {
    const db = getDb();
    await db
      .delete(userDepartments)
      .where(
        and(eq(userDepartments.tenantId, tenantId), eq(userDepartments.userId, userId)),
      );
    for (const r of rows) {
      await db.insert(userDepartments).values({
        id: uuidv7(),
        tenantId,
        userId,
        deptId: r.deptId,
        isPrimary: r.isPrimary,
        isLeader: r.isLeader,
        title: r.title,
        createdBy: updatedBy,
        updatedBy,
      });
    }
  },

  async userExists(tenantId, userId) {
    const [r] = await getDb()
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1);
    return Boolean(r);
  },
};

function mapDeptRow(r: {
  id: string;
  tenantId: string;
  parentId: string | null;
  name: string;
  code: string | null;
  path: string;
  sort: number;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
}): DeptRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    parentId: r.parentId,
    name: r.name,
    code: r.code,
    path: r.path,
    sort: r.sort,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
