import {
  BizCode,
  CreateDepartmentBodySchema,
  PatchDepartmentBodySchema,
  PutUserDepartmentsBodySchema,
  type Department,
  type DepartmentTreeNode,
  type UserDepartmentsView,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { childLogger } from '../logger.js';
import {
  applyCreateBody,
  applyPatchBody,
  buildDepartmentTree,
  createMemoryDepartmentsRepoWithUsers,
  departmentsRepo,
  pathFor,
  recomputeSubtreePaths,
  resolveTenantId,
  toPublicDepartment,
  toUserDepartmentsView,
  validateAssignmentList,
  wouldCreateCycle,
  type DepartmentsRepo,
  type DeptRow,
  type MemoryDepartmentsRepo,
} from '../services/departments.js';

export type DepartmentsRouteDeps = {
  repo?: DepartmentsRepo;
};

/**
 * 部门组织壳（ADR-057 / B5）。
 * 树 → dept.manage；用户归属 → user.manage。
 * **未**实现 DEPT_ACL_ENFORCE 检索强制。
 */
export function createDepartmentsRoutes(
  deps: DepartmentsRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const repo = deps.repo ?? departmentsRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const manageDept = requirePermission('dept.manage');
  const manageUsers = requirePermission('user.manage');

  routes.get('/admin/departments', manageDept, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const rows = await repo.listDepartments(tenantId);
    const data: Department[] = rows.map(toPublicDepartment);
    return ok(c, data);
  });

  routes.get('/admin/departments/tree', manageDept, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const rows = await repo.listDepartments(tenantId);
    const data: DepartmentTreeNode[] = buildDepartmentTree(rows);
    return ok(c, data);
  });

  routes.post('/admin/departments', manageDept, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateDepartmentBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const input = applyCreateBody(parsed.data);

    if (input.parentId) {
      const parent = await repo.getDepartment(tenantId, input.parentId);
      if (!parent) {
        return fail(c, BizCode.VALIDATION_ERROR, 'parent department not found', 400);
      }
      if (parent.status === 'disabled') {
        return fail(c, BizCode.RULE_VIOLATION, 'cannot create under disabled parent', 400);
      }
    }

    const created = await repo.createDepartment(tenantId, {
      parentId: input.parentId,
      name: input.name,
      code: input.code,
      path: '/', // memory/prod recompute with real id
      sort: input.sort,
      status: 'active',
      createdBy: auth?.userId,
    });

    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'department_create',
        deptId: created.id,
        parentId: created.parentId,
        name: created.name,
      },
      'department created',
    );
    return ok(c, toPublicDepartment(created), 201);
  });

  routes.get('/admin/departments/:deptId', manageDept, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const row = await repo.getDepartment(tenantId, c.req.param('deptId'));
    if (!row) return fail(c, BizCode.NOT_FOUND, 'department not found', 404);
    return ok(c, toPublicDepartment(row));
  });

  routes.patch('/admin/departments/:deptId', manageDept, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PatchDepartmentBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const deptId = c.req.param('deptId');
    const cur = await repo.getDepartment(tenantId, deptId);
    if (!cur) return fail(c, BizCode.NOT_FOUND, 'department not found', 404);

    const patch = applyPatchBody(cur, parsed.data);

    if (patch.parentChanged) {
      if (patch.parentId) {
        const parent = await repo.getDepartment(tenantId, patch.parentId);
        if (!parent) {
          return fail(c, BizCode.VALIDATION_ERROR, 'parent department not found', 400);
        }
      }
      const all = await repo.listDepartments(tenantId);
      const byId = new Map(all.map((d) => [d.id, d] as const));
      if (wouldCreateCycle(deptId, patch.parentId, byId)) {
        return fail(c, BizCode.RULE_VIOLATION, 'department cycle not allowed', 400);
      }
    }

    let nextPath = cur.path;
    if (patch.parentChanged) {
      const parentPath = patch.parentId
        ? (await repo.getDepartment(tenantId, patch.parentId))?.path
        : null;
      nextPath = pathFor(parentPath, deptId);
    }

    const updated = await repo.updateDepartment(tenantId, deptId, {
      parentId: patch.parentId,
      name: patch.name,
      code: patch.code,
      sort: patch.sort,
      status: patch.status,
      path: nextPath,
      updatedBy: auth?.userId,
    });

    if (patch.parentChanged && updated) {
      const all = await repo.listDepartments(tenantId);
      const byId = new Map(all.map((d) => [d.id, d] as const));
      // refresh updated row in map
      byId.set(deptId, { ...byId.get(deptId)!, path: nextPath, parentId: patch.parentId });
      const pathUpdates = recomputeSubtreePaths(deptId, nextPath, byId);
      await repo.updatePaths(tenantId, pathUpdates);
      const refreshed = await repo.getDepartment(tenantId, deptId);
      childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
        { event: 'department_patch', deptId, parentMoved: true },
        'department patched',
      );
      return ok(c, toPublicDepartment(refreshed!));
    }

    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      { event: 'department_patch', deptId },
      'department patched',
    );
    return ok(c, toPublicDepartment(updated!));
  });

  routes.delete('/admin/departments/:deptId', manageDept, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const deptId = c.req.param('deptId');
    const cur = await repo.getDepartment(tenantId, deptId);
    if (!cur) return fail(c, BizCode.NOT_FOUND, 'department not found', 404);

    const childCount = await repo.countChildren(tenantId, deptId);
    if (childCount > 0) {
      return fail(c, BizCode.RULE_VIOLATION, 'department has children', 400, { childCount });
    }
    const assignCount = await repo.countUserAssignments(tenantId, deptId);
    if (assignCount > 0) {
      return fail(c, BizCode.RULE_VIOLATION, 'department has user assignments', 400, {
        assignCount,
      });
    }

    await repo.deleteDepartment(tenantId, deptId);
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      { event: 'department_delete', deptId },
      'department deleted',
    );
    return ok(c, { id: deptId, deleted: true });
  });

  // ── 用户归属（user.manage）──
  routes.get('/admin/users/:userId/departments', manageUsers, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const userId = c.req.param('userId');
    if (!(await repo.userExists(tenantId, userId))) {
      return fail(c, BizCode.NOT_FOUND, 'user not found', 404);
    }
    const rows = await repo.listUserDepartments(tenantId, userId);
    const all = await repo.listDepartments(tenantId);
    const byId = new Map(all.map((d) => [d.id, d] as const));
    const data: UserDepartmentsView = toUserDepartmentsView(userId, rows, byId);
    return ok(c, data);
  });

  routes.put('/admin/users/:userId/departments', manageUsers, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PutUserDepartmentsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const userId = c.req.param('userId');
    if (!(await repo.userExists(tenantId, userId))) {
      return fail(c, BizCode.NOT_FOUND, 'user not found', 404);
    }

    const listCheck = validateAssignmentList(parsed.data.assignments);
    if (!listCheck.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, listCheck.message, 400);
    }

    for (const a of parsed.data.assignments) {
      const dept = await repo.getDepartment(tenantId, a.deptId);
      if (!dept) {
        return fail(c, BizCode.VALIDATION_ERROR, 'department not found', 400, {
          deptId: a.deptId,
        });
      }
      if (dept.status === 'disabled') {
        return fail(
          c,
          BizCode.RULE_VIOLATION,
          'cannot assign user to disabled department',
          400,
          { deptId: a.deptId },
        );
      }
    }

    await repo.setUserDepartments(
      tenantId,
      userId,
      parsed.data.assignments.map((a) => ({
        deptId: a.deptId,
        isPrimary: a.isPrimary ? 1 : 0,
        isLeader: a.isLeader ? 1 : 0,
        title: a.title ?? null,
      })),
      auth?.userId,
    );

    const rows = await repo.listUserDepartments(tenantId, userId);
    const all = await repo.listDepartments(tenantId);
    const byId = new Map(all.map((d) => [d.id, d] as const));
    const data = toUserDepartmentsView(userId, rows, byId);

    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'user_departments_put',
        targetUserId: userId,
        assignmentCount: rows.length,
      },
      'user departments updated',
    );
    return ok(c, data);
  });

  return routes;
}

export const departmentsRoutes = createDepartmentsRoutes();

export {
  createMemoryDepartmentsRepoWithUsers,
  type MemoryDepartmentsRepo,
  type DeptRow,
};
