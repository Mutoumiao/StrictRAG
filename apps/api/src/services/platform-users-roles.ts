import {
  isPermissionCode,
  PERMISSION_DEFINITIONS,
  ROLE_TEMPLATES,
  type PermissionCode,
} from '@strict-rag/admin-catalog';
import type {
  CreatePlatformRoleBody,
  CreatePlatformUserBody,
  PatchPlatformRoleBody,
  PatchPlatformUserBody,
  PermissionCatalogItem,
  PlatformRole,
  PlatformUser,
  PlatformUserStatus,
} from '@strict-rag/contracts';
import {
  formatLocalDateTime,
  platformRoles,
  userRoles,
  users,
} from '@strict-rag/db';
import { and, eq, inArray } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';
import { DEV_DEFAULT_TENANT } from './members.js';

export const SUPER_ADMIN_ROLE_CODE = 'super_admin';

export type RoleRow = {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  isSystem: number;
  enabled: number;
  codesJson: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type UserRow = {
  id: string;
  tenantId: string;
  email: string;
  displayName: string | null;
  status: string;
  isPlatformOperator: string;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PlatformUsersRolesRepo = {
  ensureSystemRoles(tenantId: string): Promise<void>;
  listRoles(tenantId: string): Promise<RoleRow[]>;
  getRole(tenantId: string, id: string): Promise<RoleRow | null>;
  getRoleByCode(tenantId: string, code: string): Promise<RoleRow | null>;
  createRole(
    tenantId: string,
    input: {
      code: string;
      name: string;
      isSystem: number;
      enabled: number;
      codesJson: string[];
      createdBy?: string;
    },
  ): Promise<RoleRow>;
  updateRole(
    tenantId: string,
    id: string,
    patch: Partial<{
      name: string;
      enabled: number;
      codesJson: string[];
      updatedBy: string;
    }>,
  ): Promise<RoleRow | null>;
  listUsers(tenantId: string): Promise<UserRow[]>;
  getUser(tenantId: string, id: string): Promise<UserRow | null>;
  getUserByEmail(tenantId: string, email: string): Promise<UserRow | null>;
  createUser(
    tenantId: string,
    input: {
      email: string;
      displayName: string | null;
      status: string;
      isPlatformOperator: string;
      createdBy?: string;
    },
  ): Promise<UserRow>;
  updateUser(
    tenantId: string,
    id: string,
    patch: Partial<{
      displayName: string | null;
      status: string;
      isPlatformOperator: string;
      updatedBy: string;
    }>,
  ): Promise<UserRow | null>;
  listRoleIdsForUser(userId: string): Promise<string[]>;
  listUserIdsForRole(roleId: string): Promise<string[]>;
  setUserRoles(
    tenantId: string,
    userId: string,
    roleIds: string[],
    updatedBy?: string,
  ): Promise<void>;
};

function seedSystemRoles(tenantId: string): RoleRow[] {
  return ROLE_TEMPLATES.map((tpl) => ({
    id: uuidv7(),
    tenantId,
    code: tpl.code,
    name: tpl.name,
    isSystem: 1,
    enabled: 1,
    codesJson: [...tpl.defaultCodes],
    createdAt: formatLocalDateTime(),
    updatedAt: formatLocalDateTime(),
  }));
}

export function resolveTenantId(tenantId?: string | null): string {
  return tenantId ?? DEV_DEFAULT_TENANT;
}

export function validatePermissionCodes(
  codes: readonly string[],
): { ok: true; codes: PermissionCode[] } | { ok: false; invalid: string[] } {
  const invalid = codes.filter((c) => !isPermissionCode(c));
  if (invalid.length > 0) return { ok: false, invalid };
  // 去重保序
  const seen = new Set<string>();
  const out: PermissionCode[] = [];
  for (const c of codes) {
    if (seen.has(c)) continue;
    seen.add(c);
    out.push(c as PermissionCode);
  }
  return { ok: true, codes: out };
}

export function toPublicRole(row: RoleRow): PlatformRole {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    isSystem: row.isSystem === 1,
    enabled: row.enabled === 1,
    codes: [...row.codesJson],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toPublicUser(
  row: UserRow,
  roleIds: string[],
  rolesById: Map<string, RoleRow>,
): PlatformUser {
  const roleCodes = roleIds
    .map((id) => rolesById.get(id)?.code)
    .filter((c): c is string => Boolean(c));
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    status: (row.status === 'disabled' ? 'disabled' : 'active') as PlatformUserStatus,
    isPlatformOperator: row.isPlatformOperator === '1',
    roleIds: [...roleIds],
    roleCodes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function buildPermissionCatalog(): PermissionCatalogItem[] {
  return PERMISSION_DEFINITIONS.map((p) => ({
    code: p.code,
    kind: p.kind,
    scope: p.scope,
    description: p.description,
  }));
}

/**
 * 判断用户是否持有启用中的 super_admin 角色。
 */
export function userHoldsSuperAdmin(
  roleIds: readonly string[],
  rolesById: Map<string, RoleRow>,
): boolean {
  return roleIds.some((id) => {
    const r = rolesById.get(id);
    return r && r.code === SUPER_ADMIN_ROLE_CODE && r.enabled === 1;
  });
}

/**
 * 最后超管闸：若 target 当前是 active 超管，且变更后不再是，则要求仍有其他 active 超管。
 * nextIsSuperAdmin=false 且 nextStatus=disabled 都视为失去超管能力。
 */
export function wouldRemoveLastSuperAdmin(params: {
  targetUserId: string;
  targetStatus: string;
  targetRoleIds: readonly string[];
  nextStatus: string;
  nextRoleIds: readonly string[];
  allUsers: UserRow[];
  userRoleMap: Map<string, string[]>;
  rolesById: Map<string, RoleRow>;
}): boolean {
  const was =
    params.targetStatus === 'active' &&
    userHoldsSuperAdmin(params.targetRoleIds, params.rolesById);
  const willBe =
    params.nextStatus === 'active' &&
    userHoldsSuperAdmin(params.nextRoleIds, params.rolesById);
  if (!was || willBe) return false;

  let otherActiveSuper = 0;
  for (const u of params.allUsers) {
    if (u.id === params.targetUserId) continue;
    if (u.status !== 'active') continue;
    const rids = params.userRoleMap.get(u.id) ?? [];
    if (userHoldsSuperAdmin(rids, params.rolesById)) otherActiveSuper += 1;
  }
  return otherActiveSuper === 0;
}

export function createMemoryPlatformUsersRolesRepo(): PlatformUsersRolesRepo {
  const roles = new Map<string, RoleRow>();
  const userTable = new Map<string, UserRow>();
  const userToRoles = new Map<string, string[]>();
  const seededTenants = new Set<string>();

  const repo: PlatformUsersRolesRepo = {
    async ensureSystemRoles(tenantId) {
      if (seededTenants.has(tenantId)) return;
      for (const r of seedSystemRoles(tenantId)) {
        roles.set(r.id, r);
      }
      seededTenants.add(tenantId);
    },
    async listRoles(tenantId) {
      await repo.ensureSystemRoles(tenantId);
      return [...roles.values()].filter((r) => r.tenantId === tenantId);
    },
    async getRole(tenantId, id) {
      await repo.ensureSystemRoles(tenantId);
      const r = roles.get(id);
      return r && r.tenantId === tenantId ? r : null;
    },
    async getRoleByCode(tenantId, code) {
      await repo.ensureSystemRoles(tenantId);
      return (
        [...roles.values()].find((r) => r.tenantId === tenantId && r.code === code) ?? null
      );
    },
    async createRole(tenantId, input) {
      await repo.ensureSystemRoles(tenantId);
      const row: RoleRow = {
        id: uuidv7(),
        tenantId,
        code: input.code,
        name: input.name,
        isSystem: input.isSystem,
        enabled: input.enabled,
        codesJson: [...input.codesJson],
        createdAt: formatLocalDateTime(),
        updatedAt: formatLocalDateTime(),
      };
      roles.set(row.id, row);
      return row;
    },
    async updateRole(tenantId, id, patch) {
      const cur = await repo.getRole(tenantId, id);
      if (!cur) return null;
      const next: RoleRow = {
        ...cur,
        name: patch.name ?? cur.name,
        enabled: patch.enabled ?? cur.enabled,
        codesJson: patch.codesJson ? [...patch.codesJson] : cur.codesJson,
        updatedAt: formatLocalDateTime(),
      };
      roles.set(id, next);
      return next;
    },
    async listUsers(tenantId) {
      return [...userTable.values()].filter((u) => u.tenantId === tenantId);
    },
    async getUser(tenantId, id) {
      const u = userTable.get(id);
      return u && u.tenantId === tenantId ? u : null;
    },
    async getUserByEmail(tenantId, email) {
      const lower = email.toLowerCase();
      return (
        [...userTable.values()].find(
          (u) => u.tenantId === tenantId && u.email.toLowerCase() === lower,
        ) ?? null
      );
    },
    async createUser(tenantId, input) {
      const row: UserRow = {
        id: uuidv7(),
        tenantId,
        email: input.email,
        displayName: input.displayName,
        status: input.status,
        isPlatformOperator: input.isPlatformOperator,
        createdAt: formatLocalDateTime(),
        updatedAt: formatLocalDateTime(),
      };
      userTable.set(row.id, row);
      userToRoles.set(row.id, []);
      return row;
    },
    async updateUser(tenantId, id, patch) {
      const cur = await repo.getUser(tenantId, id);
      if (!cur) return null;
      const next: UserRow = {
        ...cur,
        displayName: patch.displayName !== undefined ? patch.displayName : cur.displayName,
        status: patch.status ?? cur.status,
        isPlatformOperator: patch.isPlatformOperator ?? cur.isPlatformOperator,
        updatedAt: formatLocalDateTime(),
      };
      userTable.set(id, next);
      return next;
    },
    async listRoleIdsForUser(userId) {
      return [...(userToRoles.get(userId) ?? [])];
    },
    async listUserIdsForRole(roleId) {
      const out: string[] = [];
      for (const [uid, rids] of userToRoles) {
        if (rids.includes(roleId)) out.push(uid);
      }
      return out;
    },
    async setUserRoles(_tenantId, userId, roleIds) {
      userToRoles.set(userId, [...roleIds]);
    },
  };
  return repo;
}

/** 生产 Drizzle 实现 */
export const platformUsersRolesRepo: PlatformUsersRolesRepo = {
  async ensureSystemRoles(tenantId) {
    const db = getDb();
    const existing = await db
      .select({ id: platformRoles.id })
      .from(platformRoles)
      .where(and(eq(platformRoles.tenantId, tenantId), eq(platformRoles.isSystem, 1)))
      .limit(1);
    if (existing.length > 0) return;
    for (const r of seedSystemRoles(tenantId)) {
      await db.insert(platformRoles).values({
        id: r.id,
        tenantId: r.tenantId,
        code: r.code,
        name: r.name,
        isSystem: r.isSystem,
        enabled: r.enabled,
        codesJson: r.codesJson,
      });
    }
  },

  async listRoles(tenantId) {
    await this.ensureSystemRoles(tenantId);
    const rows = await getDb()
      .select()
      .from(platformRoles)
      .where(eq(platformRoles.tenantId, tenantId));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      enabled: r.enabled,
      codesJson: r.codesJson ?? [],
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  },

  async getRole(tenantId, id) {
    await this.ensureSystemRoles(tenantId);
    const [r] = await getDb()
      .select()
      .from(platformRoles)
      .where(and(eq(platformRoles.tenantId, tenantId), eq(platformRoles.id, id)))
      .limit(1);
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      enabled: r.enabled,
      codesJson: r.codesJson ?? [],
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    };
  },

  async getRoleByCode(tenantId, code) {
    await this.ensureSystemRoles(tenantId);
    const [r] = await getDb()
      .select()
      .from(platformRoles)
      .where(and(eq(platformRoles.tenantId, tenantId), eq(platformRoles.code, code)))
      .limit(1);
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      isSystem: r.isSystem,
      enabled: r.enabled,
      codesJson: r.codesJson ?? [],
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    };
  },

  async createRole(tenantId, input) {
    await this.ensureSystemRoles(tenantId);
    const id = uuidv7();
    await getDb().insert(platformRoles).values({
      id,
      tenantId,
      code: input.code,
      name: input.name,
      isSystem: input.isSystem,
      enabled: input.enabled,
      codesJson: input.codesJson,
      createdBy: input.createdBy,
    });
    const row = await this.getRole(tenantId, id);
    if (!row) throw new Error('createRole failed');
    return row;
  },

  async updateRole(tenantId, id, patch) {
    const cur = await this.getRole(tenantId, id);
    if (!cur) return null;
    await getDb()
      .update(platformRoles)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.codesJson !== undefined ? { codesJson: patch.codesJson } : {}),
        updatedBy: patch.updatedBy,
      })
      .where(and(eq(platformRoles.tenantId, tenantId), eq(platformRoles.id, id)));
    return this.getRole(tenantId, id);
  },

  async listUsers(tenantId) {
    const rows = await getDb().select().from(users).where(eq(users.tenantId, tenantId));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      email: r.email,
      displayName: r.displayName ?? null,
      status: r.status,
      isPlatformOperator: r.isPlatformOperator,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    }));
  },

  async getUser(tenantId, id) {
    const [r] = await getDb()
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)))
      .limit(1);
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      email: r.email,
      displayName: r.displayName ?? null,
      status: r.status,
      isPlatformOperator: r.isPlatformOperator,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    };
  },

  async getUserByEmail(tenantId, email) {
    const [r] = await getDb()
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
      .limit(1);
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      email: r.email,
      displayName: r.displayName ?? null,
      status: r.status,
      isPlatformOperator: r.isPlatformOperator,
      createdAt: r.createdAt ?? null,
      updatedAt: r.updatedAt ?? null,
    };
  },

  async createUser(tenantId, input) {
    const id = uuidv7();
    await getDb().insert(users).values({
      id,
      tenantId,
      email: input.email,
      displayName: input.displayName,
      platformRole: 'user',
      status: input.status,
      isPlatformOperator: input.isPlatformOperator,
      createdBy: input.createdBy,
    });
    const row = await this.getUser(tenantId, id);
    if (!row) throw new Error('createUser failed');
    return row;
  },

  async updateUser(tenantId, id, patch) {
    const cur = await this.getUser(tenantId, id);
    if (!cur) return null;
    await getDb()
      .update(users)
      .set({
        ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.isPlatformOperator !== undefined
          ? { isPlatformOperator: patch.isPlatformOperator }
          : {}),
        updatedBy: patch.updatedBy,
      })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, id)));
    return this.getUser(tenantId, id);
  },

  async listRoleIdsForUser(userId) {
    const rows = await getDb()
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, userId));
    return rows.map((r) => r.roleId);
  },

  async listUserIdsForRole(roleId) {
    const rows = await getDb()
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(eq(userRoles.roleId, roleId));
    return rows.map((r) => r.userId);
  },

  async setUserRoles(tenantId, userId, roleIds, updatedBy) {
    const db = getDb();
    await db.delete(userRoles).where(eq(userRoles.userId, userId));
    if (roleIds.length === 0) return;
    // 校验 role 存在
    const found = await db
      .select({ id: platformRoles.id })
      .from(platformRoles)
      .where(and(eq(platformRoles.tenantId, tenantId), inArray(platformRoles.id, roleIds)));
    if (found.length !== roleIds.length) {
      throw new Error('role_not_found');
    }
    for (const roleId of roleIds) {
      await db.insert(userRoles).values({
        id: uuidv7(),
        tenantId,
        userId,
        roleId,
        createdBy: updatedBy,
      });
    }
  },
};

export async function loadRolesById(
  repo: PlatformUsersRolesRepo,
  tenantId: string,
): Promise<Map<string, RoleRow>> {
  const list = await repo.listRoles(tenantId);
  return new Map(list.map((r) => [r.id, r]));
}

export async function loadUserRoleMap(
  repo: PlatformUsersRolesRepo,
  users: UserRow[],
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  for (const u of users) {
    map.set(u.id, await repo.listRoleIdsForUser(u.id));
  }
  return map;
}

export function applyCreateUserBody(body: CreatePlatformUserBody): {
  email: string;
  displayName: string | null;
  status: string;
  isPlatformOperator: string;
  roleIds: string[];
} {
  return {
    email: body.email.trim().toLowerCase(),
    displayName: body.displayName ?? null,
    status: body.status ?? 'active',
    isPlatformOperator: '1',
    roleIds: body.roleIds ?? [],
  };
}

export function applyPatchUserBody(
  cur: UserRow,
  body: PatchPlatformUserBody,
): {
  displayName: string | null;
  status: string;
  roleIds?: string[];
} {
  return {
    displayName: body.displayName !== undefined ? body.displayName : cur.displayName,
    status: body.status ?? cur.status,
    roleIds: body.roleIds,
  };
}

export function applyCreateRoleBody(body: CreatePlatformRoleBody): {
  code: string;
  name: string;
  isSystem: number;
  enabled: number;
  codesJson: string[];
} {
  return {
    code: body.code,
    name: body.name,
    isSystem: 0,
    enabled: body.enabled === false ? 0 : 1,
    codesJson: body.codes ?? [],
  };
}

export function applyPatchRoleBody(
  cur: RoleRow,
  body: PatchPlatformRoleBody,
): {
  name: string;
  enabled: number;
  codesJson?: string[];
} {
  return {
    name: body.name ?? cur.name,
    enabled: body.enabled === undefined ? cur.enabled : body.enabled ? 1 : 0,
    codesJson: body.codes,
  };
}
