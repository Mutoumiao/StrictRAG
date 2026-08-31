/**
 * 目标：空库须能按 env 引导出 active 超管与 catalog 全码；缺 env 须失败；已有超管不得改哈希。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 AD1–AD3 · ADR-056
 * 被测：bootstrapSuperAdmin · createApp
 * 简介：直接调引导函数；AD2 断言抛错；createApp 不自动跑；不测密码登录 HTTP。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_PERMISSION_CODES, PERMISSION_DEFINITIONS } from '@strict-rag/admin-catalog';
import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';
import { hashPassword } from '../../src/services/password-hash.js';
import {
  SUPER_ADMIN_ROLE_CODE,
  createMemoryPlatformUsersRolesRepo,
  userHoldsSuperAdmin,
  type PlatformUsersRolesRepo,
  type RoleRow,
} from '../../src/services/platform-users-roles.js';
import {
  SuperAdminBootstrapError,
  bootstrapSuperAdmin,
  createMemoryPermissionDefinitionsStore,
} from '../../src/services/superadmin-bootstrap.js';

const TENANT = DEV_DEFAULT_TENANT;
const EMAIL = 'super@example.com';
const PASSWORD = 'bootstrap-secret-1';

async function runBootstrap(
  repo: PlatformUsersRolesRepo,
  permissions = createMemoryPermissionDefinitionsStore(),
  env: { email?: string | null; password?: string | null } = { email: EMAIL, password: PASSWORD },
) {
  await bootstrapSuperAdmin({
    tenantId: TENANT,
    email: env.email,
    password: env.password,
    permissions,
    repo,
    hashPassword,
  });
  return permissions;
}

async function findActiveSuperAdmin(repo: PlatformUsersRolesRepo) {
  const sa = await repo.peekRoleByCode(TENANT, SUPER_ADMIN_ROLE_CODE);
  if (!sa) return { sa: null, user: null };
  const users = await repo.listUsers(TENANT);
  const rolesById = new Map<string, RoleRow>([[sa.id, sa]]);
  for (const user of users) {
    if (user.status !== 'active') continue;
    const roleIds = await repo.listRoleIdsForUser(user.id);
    if (userHoldsSuperAdmin(roleIds, rolesById)) return { sa, user };
  }
  return { sa, user: null };
}

describe('启动引导超管 AD1–AD3', () => {
  it('AD1：空库 + 两 env → 有 active 超管；表内码 = catalog 全量；超管 codesJson = 全码', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    const permissions = await runBootstrap(repo);
    const { sa, user } = await findActiveSuperAdmin(repo);
    expect(user).toBeTruthy();
    expect(user?.status).toBe('active');
    expect(user?.isPlatformOperator).toBe('1');
    expect(sa?.codesJson).toEqual([...ALL_PERMISSION_CODES]);
    expect(sa?.enabled).toBe(1);

    const rows = await permissions.listAll();
    expect(rows.map((r) => r.code).sort()).toEqual([...ALL_PERMISSION_CODES].sort());
    expect(rows.every((r) => r.source === 'catalog')).toBe(true);
    const editor = rows.find((r) => r.code === 'doc.editor');
    expect(editor?.kind).toBe('page+action');

    const secrets = user ? await repo.getUserLoginSecrets(TENANT, user.id) : null;
    expect(secrets?.platformRole).toBe('platform_admin');
    expect(secrets?.passwordHash).toBeTruthy();
    expect(secrets?.passwordHash).not.toContain(PASSWORD);
    expect(secrets?.passwordHash?.startsWith('scrypt$')).toBe(true);
  });

  it('AD2：无超管且缺 EMAIL 或 PASSWORD → 引导失败', async () => {
    const missingEmail = createMemoryPlatformUsersRolesRepo();
    await expect(
      runBootstrap(missingEmail, createMemoryPermissionDefinitionsStore(), {
        email: '',
        password: PASSWORD,
      }),
    ).rejects.toBeInstanceOf(SuperAdminBootstrapError);

    const missingPassword = createMemoryPlatformUsersRolesRepo();
    await expect(
      runBootstrap(missingPassword, createMemoryPermissionDefinitionsStore(), {
        email: EMAIL,
        password: '  ',
      }),
    ).rejects.toBeInstanceOf(SuperAdminBootstrapError);

    const missingBoth = createMemoryPlatformUsersRolesRepo();
    await expect(
      runBootstrap(missingBoth, createMemoryPermissionDefinitionsStore(), {
        email: undefined,
        password: undefined,
      }),
    ).rejects.toBeInstanceOf(SuperAdminBootstrapError);

    expect((await findActiveSuperAdmin(missingBoth)).user).toBeNull();
  });

  it('AD3：已有超管再跑 → password_hash 不变；超管码仍全', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    await runBootstrap(repo);
    const first = await findActiveSuperAdmin(repo);
    expect(first.user).toBeTruthy();
    const before = first.user
      ? await repo.getUserLoginSecrets(TENANT, first.user.id)
      : null;
    if (first.sa) {
      await repo.updateRole(TENANT, first.sa.id, { codesJson: ['admin.shell'] });
    }

    await runBootstrap(repo, createMemoryPermissionDefinitionsStore(), {
      email: EMAIL,
      password: 'another-password-should-not-apply',
    });

    const second = await findActiveSuperAdmin(repo);
    expect(second.sa?.codesJson).toEqual([...ALL_PERMISSION_CODES]);
    const after = second.user
      ? await repo.getUserLoginSecrets(TENANT, second.user.id)
      : null;
    expect(after?.passwordHash).toBe(before?.passwordHash);
  });

  it('同邮箱非超管用户被绑上超管，哈希不变', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    const existing = await repo.createUser(TENANT, {
      email: EMAIL,
      displayName: '已有账号',
      status: 'disabled',
      isPlatformOperator: '0',
      platformRole: 'user',
      passwordHash: 'already-hashed',
    });
    await runBootstrap(repo);
    const { sa, user } = await findActiveSuperAdmin(repo);
    expect(user?.id).toBe(existing.id);
    expect(user?.status).toBe('active');
    expect(user?.isPlatformOperator).toBe('1');
    expect(sa?.codesJson).toEqual([...ALL_PERMISSION_CODES]);
    const secrets = await repo.getUserLoginSecrets(TENANT, existing.id);
    expect(secrets?.passwordHash).toBe('already-hashed');
    expect(secrets?.platformRole).toBe('user');
  });

  it('createApp 不自动引导', () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const appSrc = readFileSync(path.join(here, '../../src/app.ts'), 'utf8');
    expect(appSrc).not.toMatch(/superadmin-bootstrap|bootstrapSuperAdmin|runSuperAdminBootstrap/);
    expect(() => createApp()).not.toThrow();
  });

  it('已有 kb_admin 自定义绑码，引导后不被模板覆盖', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    await repo.ensureSystemRoles(TENANT);
    const kb = await repo.getRoleByCode(TENANT, 'kb_admin');
    expect(kb).toBeTruthy();
    if (!kb) return;
    await repo.updateRole(TENANT, kb.id, { codesJson: ['admin.shell'] });
    await runBootstrap(repo);
    const after = await repo.peekRoleByCode(TENANT, 'kb_admin');
    expect(after?.codesJson).toEqual(['admin.shell']);
    expect((await findActiveSuperAdmin(repo)).user).toBeTruthy();
  });

  it('upsert 更新 catalog 元数据；表里多出来的码不删', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    const permissions = createMemoryPermissionDefinitionsStore([
      {
        code: 'admin.shell',
        kind: 'action',
        scope: 'kb',
        description: '过期文案',
        source: 'manual',
      },
      {
        code: 'legacy.orphan',
        kind: 'action',
        scope: 'platform',
        description: '历史残留',
        source: 'manual',
      },
    ]);
    await runBootstrap(repo, permissions);
    const rows = await permissions.listAll();
    const shell = PERMISSION_DEFINITIONS.find((p) => p.code === 'admin.shell');
    expect(rows.find((r) => r.code === 'admin.shell')).toEqual({
      code: 'admin.shell',
      kind: shell?.kind,
      scope: shell?.scope,
      description: shell?.description,
      source: 'catalog',
    });
    expect(rows.find((r) => r.code === 'legacy.orphan')).toEqual({
      code: 'legacy.orphan',
      kind: 'action',
      scope: 'platform',
      description: '历史残留',
      source: 'manual',
    });
  });
});
