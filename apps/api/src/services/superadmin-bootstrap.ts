/**
 * ADR-056 启动引导超管（剧本 AD1–AD3）。
 * 术语是 env 创建第一位超管，不是引导页。
 * 运行时求值仍 codesJson；本模块只 upsert 字典表并保证超管角色全码。
 */

import {
  ALL_PERMISSION_CODES,
  getRoleTemplate,
  PERMISSION_DEFINITIONS,
  type PermissionDef,
} from '@strict-rag/admin-catalog';
import { permissionDefinitions } from '@strict-rag/db';

import { env } from '../env.js';
import { getDb } from './db.js';
import { DEV_DEFAULT_TENANT } from './members.js';
import { hashPassword } from './password-hash.js';
import {
  SUPER_ADMIN_ROLE_CODE,
  platformUsersRolesRepo,
  userHoldsSuperAdmin,
  type PlatformUsersRolesRepo,
  type RoleRow,
} from './platform-users-roles.js';

export type PermissionDefinitionRow = {
  code: string;
  kind: string;
  scope: string;
  description: string;
  source: string;
};

export type PermissionDefinitionsStore = {
  listAll(): Promise<PermissionDefinitionRow[]>;
  upsert(row: PermissionDefinitionRow): Promise<void>;
};

export class SuperAdminBootstrapError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SuperAdminBootstrapError';
  }
}

export function createMemoryPermissionDefinitionsStore(
  initial: readonly PermissionDefinitionRow[] = [],
): PermissionDefinitionsStore {
  const map = new Map<string, PermissionDefinitionRow>();
  for (const row of initial) map.set(row.code, { ...row });
  return {
    async listAll() {
      return [...map.values()].map((row) => ({ ...row }));
    },
    async upsert(row) {
      map.set(row.code, { ...row });
    },
  };
}

export function createDbPermissionDefinitionsStore(): PermissionDefinitionsStore {
  return {
    async listAll() {
      const rows = await getDb().select().from(permissionDefinitions);
      return rows.map((r) => ({
        code: r.code,
        kind: r.kind,
        scope: r.scope,
        description: r.description,
        source: r.source,
      }));
    },
    async upsert(row) {
      await getDb()
        .insert(permissionDefinitions)
        .values(row)
        .onConflictDoUpdate({
          target: permissionDefinitions.code,
          set: {
            kind: row.kind,
            scope: row.scope,
            description: row.description,
            source: row.source,
          },
        });
    },
  };
}

export type SuperAdminBootstrapInput = {
  tenantId: string;
  email?: string | null;
  password?: string | null;
  permissions: PermissionDefinitionsStore;
  repo: PlatformUsersRolesRepo;
  hashPassword: (plain: string) => Promise<string>;
  catalog?: readonly PermissionDef[];
};

async function tenantHasActiveSuperAdmin(
  repo: PlatformUsersRolesRepo,
  tenantId: string,
  sa: RoleRow,
): Promise<boolean> {
  if (sa.enabled !== 1) return false;
  const users = await repo.listUsers(tenantId);
  const rolesById = new Map<string, RoleRow>([[sa.id, sa]]);
  for (const user of users) {
    if (user.status !== 'active') continue;
    const roleIds = await repo.listRoleIdsForUser(user.id);
    if (userHoldsSuperAdmin(roleIds, rolesById)) return true;
  }
  return false;
}

export async function bootstrapSuperAdmin(input: SuperAdminBootstrapInput): Promise<void> {
  const catalog = input.catalog ?? PERMISSION_DEFINITIONS;
  const allCodes = catalog === PERMISSION_DEFINITIONS ? [...ALL_PERMISSION_CODES] : catalog.map((p) => p.code);

  for (const def of catalog) {
    await input.permissions.upsert({
      code: def.code,
      kind: def.kind,
      scope: def.scope,
      description: def.description,
      source: 'catalog',
    });
  }

  let sa = await input.repo.peekRoleByCode(input.tenantId, SUPER_ADMIN_ROLE_CODE);
  if (!sa) {
    sa = await input.repo.insertRole(input.tenantId, {
      code: SUPER_ADMIN_ROLE_CODE,
      name: getRoleTemplate(SUPER_ADMIN_ROLE_CODE)?.name ?? '超级管理员',
      isSystem: 1,
      enabled: 1,
      codesJson: [...allCodes],
    });
  } else {
    const patched = await input.repo.updateRole(input.tenantId, sa.id, {
      codesJson: [...allCodes],
      enabled: 1,
    });
    sa = patched ?? { ...sa, codesJson: [...allCodes], enabled: 1 };
  }

  if (await tenantHasActiveSuperAdmin(input.repo, input.tenantId, sa)) {
    return;
  }

  const email = input.email?.trim().toLowerCase() ?? '';
  const password = input.password ?? '';
  if (!email || !password.trim()) {
    throw new SuperAdminBootstrapError(
      '无 active 超管：须同时配置 SUPER_ADMIN_EMAIL 与 SUPER_ADMIN_PASSWORD',
    );
  }

  const existing = await input.repo.getUserByEmail(input.tenantId, email);
  if (existing) {
    await input.repo.updateUser(input.tenantId, existing.id, {
      status: 'active',
      isPlatformOperator: '1',
    });
    const roleIds = await input.repo.listRoleIdsForUser(existing.id);
    if (!roleIds.includes(sa.id)) {
      await input.repo.setUserRoles(input.tenantId, existing.id, [...roleIds, sa.id]);
    }
    return;
  }

  const user = await input.repo.createUser(input.tenantId, {
    email,
    displayName: email,
    status: 'active',
    isPlatformOperator: '1',
    platformRole: 'platform_admin',
    passwordHash: await input.hashPassword(password),
  });
  await input.repo.setUserRoles(input.tenantId, user.id, [sa.id]);
}

/** 生产入口：默认租户 + 真实 PG。createApp() 不得调用。 */
export async function runSuperAdminBootstrap(): Promise<void> {
  await bootstrapSuperAdmin({
    tenantId: DEV_DEFAULT_TENANT,
    email: env.SUPER_ADMIN_EMAIL,
    password: env.SUPER_ADMIN_PASSWORD,
    permissions: createDbPermissionDefinitionsStore(),
    repo: platformUsersRolesRepo,
    hashPassword,
  });
}
