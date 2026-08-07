import {
  AssignUserRolesBodySchema,
  BizCode,
  CreatePlatformRoleBodySchema,
  CreatePlatformUserBodySchema,
  PatchPlatformRoleBodySchema,
  PatchPlatformUserBodySchema,
  PutRolePermissionsBodySchema,
  type PlatformRole,
  type PlatformUser,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { childLogger } from '../logger.js';
import {
  applyCreateRoleBody,
  applyCreateUserBody,
  applyPatchRoleBody,
  applyPatchUserBody,
  buildPermissionCatalog,
  loadRolesById,
  loadUserRoleMap,
  platformUsersRolesRepo,
  resolveTenantId,
  toPublicRole,
  toPublicUser,
  validatePermissionCodes,
  wouldRemoveLastSuperAdmin,
  type PlatformUsersRolesRepo,
} from '../services/platform-users-roles.js';

export type PlatformUsersRolesRouteDeps = {
  repo?: PlatformUsersRolesRepo;
};

/**
 * 平台用户与角色（ADR-056 / B4）。
 * users → user.manage；roles → role.perm.manage。
 */
export function createPlatformUsersRolesRoutes(
  deps: PlatformUsersRolesRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const repo = deps.repo ?? platformUsersRolesRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const manageUsers = requirePermission('user.manage');
  const manageRoles = requirePermission('role.perm.manage');

  // ── permission catalog（user 或 role 码均可） ──
  routes.get('/admin/permission-catalog', async (c) => {
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }
    const codes = c.get('effectiveCodes');
    if (!codes?.has('user.manage') && !codes?.has('role.perm.manage')) {
      return fail(c, BizCode.FORBIDDEN, 'missing permission: user.manage or role.perm.manage', 403);
    }
    return ok(c, buildPermissionCatalog());
  });

  // ── roles ──
  routes.get('/admin/roles', manageRoles, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const rows = await repo.listRoles(tenantId);
    const data: PlatformRole[] = rows.map(toPublicRole);
    return ok(c, data);
  });

  routes.post('/admin/roles', manageRoles, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreatePlatformRoleBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const codesCheck = validatePermissionCodes(parsed.data.codes ?? []);
    if (!codesCheck.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, 'unknown permission codes', 400, {
        invalid: codesCheck.invalid,
      });
    }
    const existing = await repo.getRoleByCode(tenantId, parsed.data.code);
    if (existing) {
      return fail(c, BizCode.CONFLICT, 'role code already exists', 409);
    }
    const input = applyCreateRoleBody({ ...parsed.data, codes: codesCheck.codes });
    const created = await repo.createRole(tenantId, {
      ...input,
      createdBy: auth?.userId,
    });
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'platform_role_create',
        roleId: created.id,
        code: created.code,
        codeCount: created.codesJson.length,
      },
      'platform role created',
    );
    return ok(c, toPublicRole(created), 201);
  });

  routes.get('/admin/roles/:roleId', manageRoles, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const row = await repo.getRole(tenantId, c.req.param('roleId'));
    if (!row) return fail(c, BizCode.NOT_FOUND, 'role not found', 404);
    return ok(c, toPublicRole(row));
  });

  routes.patch('/admin/roles/:roleId', manageRoles, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PatchPlatformRoleBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const roleId = c.req.param('roleId');
    const cur = await repo.getRole(tenantId, roleId);
    if (!cur) return fail(c, BizCode.NOT_FOUND, 'role not found', 404);

    let codesJson: string[] | undefined;
    if (parsed.data.codes !== undefined) {
      const codesCheck = validatePermissionCodes(parsed.data.codes);
      if (!codesCheck.ok) {
        return fail(c, BizCode.VALIDATION_ERROR, 'unknown permission codes', 400, {
          invalid: codesCheck.invalid,
        });
      }
      codesJson = codesCheck.codes;
    }
    const patch = applyPatchRoleBody(cur, parsed.data);
    // 禁止禁用系统 super_admin 角色（否则会绕过最后超管闸）
    if (
      cur.code === 'super_admin' &&
      cur.isSystem === 1 &&
      patch.enabled === 0
    ) {
      return fail(
        c,
        BizCode.RULE_VIOLATION,
        'cannot disable system super_admin role',
        400,
      );
    }
    const updated = await repo.updateRole(tenantId, roleId, {
      name: patch.name,
      enabled: patch.enabled,
      codesJson: codesJson ?? patch.codesJson,
      updatedBy: auth?.userId,
    });
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      { event: 'platform_role_patch', roleId, code: cur.code },
      'platform role patched',
    );
    return ok(c, toPublicRole(updated!));
  });

  routes.put('/admin/roles/:roleId/permissions', manageRoles, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PutRolePermissionsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const codesCheck = validatePermissionCodes(parsed.data.codes);
    if (!codesCheck.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, 'unknown permission codes', 400, {
        invalid: codesCheck.invalid,
      });
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const roleId = c.req.param('roleId');
    const cur = await repo.getRole(tenantId, roleId);
    if (!cur) return fail(c, BizCode.NOT_FOUND, 'role not found', 404);
    const updated = await repo.updateRole(tenantId, roleId, {
      codesJson: codesCheck.codes,
      updatedBy: auth?.userId,
    });
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'platform_role_permissions',
        roleId,
        code: cur.code,
        codeCount: codesCheck.codes.length,
      },
      'platform role permissions updated',
    );
    return ok(c, toPublicRole(updated!));
  });

  // ── users ──
  routes.get('/admin/users', manageUsers, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    await repo.ensureSystemRoles(tenantId);
    const [userList, rolesById] = await Promise.all([
      repo.listUsers(tenantId),
      loadRolesById(repo, tenantId),
    ]);
    const data: PlatformUser[] = [];
    for (const u of userList) {
      const roleIds = await repo.listRoleIdsForUser(u.id);
      data.push(toPublicUser(u, roleIds, rolesById));
    }
    return ok(c, data);
  });

  routes.post('/admin/users', manageUsers, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreatePlatformUserBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    await repo.ensureSystemRoles(tenantId);
    const input = applyCreateUserBody(parsed.data);
    const dup = await repo.getUserByEmail(tenantId, input.email);
    if (dup) {
      return fail(c, BizCode.CONFLICT, 'email already exists', 409);
    }
    // 校验 roleIds
    const rolesById = await loadRolesById(repo, tenantId);
    for (const rid of input.roleIds) {
      if (!rolesById.has(rid)) {
        return fail(c, BizCode.VALIDATION_ERROR, 'unknown role id', 400, { roleId: rid });
      }
    }
    const created = await repo.createUser(tenantId, {
      email: input.email,
      displayName: input.displayName,
      status: input.status,
      isPlatformOperator: input.isPlatformOperator,
      createdBy: auth?.userId,
    });
    if (input.roleIds.length > 0) {
      await repo.setUserRoles(tenantId, created.id, input.roleIds, auth?.userId);
    }
    const roleIds = await repo.listRoleIdsForUser(created.id);
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'platform_user_create',
        targetUserId: created.id,
        email: created.email,
        roleCount: roleIds.length,
      },
      'platform user created',
    );
    return ok(c, toPublicUser(created, roleIds, rolesById), 201);
  });

  routes.get('/admin/users/:userId', manageUsers, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const userId = c.req.param('userId');
    const row = await repo.getUser(tenantId, userId);
    if (!row) return fail(c, BizCode.NOT_FOUND, 'user not found', 404);
    const rolesById = await loadRolesById(repo, tenantId);
    const roleIds = await repo.listRoleIdsForUser(userId);
    return ok(c, toPublicUser(row, roleIds, rolesById));
  });

  routes.patch('/admin/users/:userId', manageUsers, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PatchPlatformUserBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const userId = c.req.param('userId');
    const cur = await repo.getUser(tenantId, userId);
    if (!cur) return fail(c, BizCode.NOT_FOUND, 'user not found', 404);

    const rolesById = await loadRolesById(repo, tenantId);
    const curRoleIds = await repo.listRoleIdsForUser(userId);
    const patch = applyPatchUserBody(cur, parsed.data);
    let nextRoleIds = curRoleIds;
    if (patch.roleIds !== undefined) {
      for (const rid of patch.roleIds) {
        if (!rolesById.has(rid)) {
          return fail(c, BizCode.VALIDATION_ERROR, 'unknown role id', 400, { roleId: rid });
        }
      }
      nextRoleIds = patch.roleIds;
    }

    const allUsers = await repo.listUsers(tenantId);
    const userRoleMap = await loadUserRoleMap(repo, allUsers);
    if (
      wouldRemoveLastSuperAdmin({
        targetUserId: userId,
        targetStatus: cur.status,
        targetRoleIds: curRoleIds,
        nextStatus: patch.status,
        nextRoleIds,
        allUsers,
        userRoleMap,
        rolesById,
      })
    ) {
      return fail(c, BizCode.RULE_VIOLATION, 'cannot remove or disable the last active super_admin', 400);
    }

    const updated = await repo.updateUser(tenantId, userId, {
      displayName: patch.displayName,
      status: patch.status,
      updatedBy: auth?.userId,
    });
    if (patch.roleIds !== undefined) {
      await repo.setUserRoles(tenantId, userId, nextRoleIds, auth?.userId);
    }
    const roleIds = await repo.listRoleIdsForUser(userId);
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'platform_user_patch',
        targetUserId: userId,
        status: patch.status,
        roleCount: roleIds.length,
      },
      'platform user patched',
    );
    return ok(c, toPublicUser(updated!, roleIds, rolesById));
  });

  routes.post('/admin/users/:userId/roles', manageUsers, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = AssignUserRolesBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const userId = c.req.param('userId');
    const cur = await repo.getUser(tenantId, userId);
    if (!cur) return fail(c, BizCode.NOT_FOUND, 'user not found', 404);

    const rolesById = await loadRolesById(repo, tenantId);
    for (const rid of parsed.data.roleIds) {
      if (!rolesById.has(rid)) {
        return fail(c, BizCode.VALIDATION_ERROR, 'unknown role id', 400, { roleId: rid });
      }
    }
    const curRoleIds = await repo.listRoleIdsForUser(userId);
    const allUsers = await repo.listUsers(tenantId);
    const userRoleMap = await loadUserRoleMap(repo, allUsers);
    if (
      wouldRemoveLastSuperAdmin({
        targetUserId: userId,
        targetStatus: cur.status,
        targetRoleIds: curRoleIds,
        nextStatus: cur.status,
        nextRoleIds: parsed.data.roleIds,
        allUsers,
        userRoleMap,
        rolesById,
      })
    ) {
      return fail(c, BizCode.RULE_VIOLATION, 'cannot remove or disable the last active super_admin', 400);
    }
    await repo.setUserRoles(tenantId, userId, parsed.data.roleIds, auth?.userId);
    const roleIds = await repo.listRoleIdsForUser(userId);
    childLogger({ requestId: c.get('requestId'), userId: auth?.userId }).info(
      {
        event: 'platform_user_roles',
        targetUserId: userId,
        roleCount: roleIds.length,
      },
      'platform user roles assigned',
    );
    return ok(c, toPublicUser(cur, roleIds, rolesById));
  });

  return routes;
}

export const platformUsersRolesRoutes = createPlatformUsersRolesRoutes();
