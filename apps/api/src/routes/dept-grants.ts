import {
  BizCode,
  CreateDeptCrossGrantBodySchema,
  ListDeptCrossGrantsQuerySchema,
  type DeptCrossGrant,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { z } from 'zod';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { extractPgError, mapPgErrorToBiz } from '../lib/pg-error.js';
import { fail, ok } from '../lib/response.js';
import { childLogger } from '../logger.js';
import {
  departmentsRepo,
  resolveTenantId,
  type DepartmentsRepo,
} from '../services/departments.js';
import {
  createMemoryDeptGrantsRepo,
  deptGrantsRepo,
  toPublicGrant,
  type DeptGrantsRepo,
} from '../services/dept-grants.js';
import {
  platformUsersRolesRepo,
  type PlatformUsersRolesRepo,
} from '../services/platform-users-roles.js';

export type DeptGrantsRouteDeps = {
  grants?: DeptGrantsRepo;
  departments?: Pick<DepartmentsRepo, 'getDepartment'>;
  users?: Pick<PlatformUsersRolesRepo, 'getUser'>;
};

/**
 * 跨部门授权 CRUD（ADR-057 / P3b-GRANT）。
 * 始终 requirePermission('dept.manage')，不走 WhenEnforced。
 * CRUD 不读检索。enforce 开时 retrieve 可读未过期精确 grant。
 */
export function createDeptGrantsRoutes(
  deps: DeptGrantsRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const grants = deps.grants ?? deptGrantsRepo;
  const departments = deps.departments ?? departmentsRepo;
  const users = deps.users ?? platformUsersRolesRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const manage = requirePermission('dept.manage');

  /** 表无 tenant_id：用本租户 user/dept 收口，避免跨租户 list/delete */
  async function inTenant(
    tenantId: string,
    userId: string,
    deptId: string,
  ): Promise<boolean> {
    const [user, dept] = await Promise.all([
      users.getUser(tenantId, userId),
      departments.getDepartment(tenantId, deptId),
    ]);
    return Boolean(user && dept);
  }

  routes.get('/admin/dept-cross-grants', manage, async (c) => {
    const query: Record<string, string> = {};
    const userId = c.req.query('userId');
    const deptId = c.req.query('deptId');
    if (userId !== undefined) query.userId = userId;
    if (deptId !== undefined) query.deptId = deptId;
    const parsed = ListDeptCrossGrantsQuerySchema.safeParse(query);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const rows = await grants.listGrants(parsed.data);
    const visible: typeof rows = [];
    for (const row of rows) {
      if (await inTenant(tenantId, row.userId, row.deptId)) visible.push(row);
    }
    const data: DeptCrossGrant[] = visible.map(toPublicGrant);
    return ok(c, data);
  });

  routes.post('/admin/dept-cross-grants', manage, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateDeptCrossGrantBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);

    const user = await users.getUser(tenantId, parsed.data.userId);
    if (!user) {
      return fail(c, BizCode.VALIDATION_ERROR, 'user not found', 400);
    }
    const dept = await departments.getDepartment(tenantId, parsed.data.deptId);
    if (!dept) {
      return fail(c, BizCode.VALIDATION_ERROR, 'department not found', 400);
    }

    try {
      const row = await grants.createGrant({
        userId: parsed.data.userId,
        deptId: parsed.data.deptId,
        maxVisibilityLevel: parsed.data.maxVisibilityLevel,
        expiresAt: parsed.data.expiresAt ?? null,
        reason: parsed.data.reason ?? null,
        grantedBy: auth?.userId ?? null,
      });
      childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
        { event: 'dept_cross_grant_create', grantId: row.id, userId: row.userId, deptId: row.deptId },
        'dept cross grant created',
      );
      return ok(c, toPublicGrant(row), 201);
    } catch (err) {
      const pg = extractPgError(err);
      if (pg) {
        const mapped = mapPgErrorToBiz(pg);
        return fail(c, mapped.code, mapped.message, mapped.httpStatus);
      }
      throw err;
    }
  });

  routes.delete('/admin/dept-cross-grants/:id', manage, async (c) => {
    const auth = c.get('auth');
    const id = c.req.param('id');
    if (!z.string().uuid().safeParse(id).success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid id', 400);
    }
    const row = await grants.getGrant(id);
    const tenantId = resolveTenantId(auth?.tenantId);
    if (!row || !(await inTenant(tenantId, row.userId, row.deptId))) {
      return fail(c, BizCode.NOT_FOUND, 'grant not found', 404);
    }
    const deleted = await grants.deleteGrant(id);
    if (!deleted) {
      return fail(c, BizCode.NOT_FOUND, 'grant not found', 404);
    }
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      { event: 'dept_cross_grant_delete', grantId: id },
      'dept cross grant deleted',
    );
    return ok(c, { id, deleted: true });
  });

  return routes;
}

export const deptGrantsRoutes = createDeptGrantsRoutes();

export { createMemoryDeptGrantsRepo };
