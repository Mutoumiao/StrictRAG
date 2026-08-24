/**
 * 目标：已有 isSystem 角色时 ensureSystemRoles 不再 insert。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 AD3（部分）
 * 被测：createMemoryPlatformUsersRolesRepo.ensureSystemRoles
 * 简介：只锁跳过重种子，≠ 补码、≠ 不重置密码（无该启动器）。
 */

import { describe, expect, it } from 'vitest';

import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';
import { createMemoryPlatformUsersRolesRepo } from '../../src/services/platform-users-roles.js';

const TENANT = DEV_DEFAULT_TENANT;

describe('AD3 ensureSystemRoles skip reseed（部分）', () => {
  it('已有 isSystem 角色则第二次 ensure 不再 insert，也不回写 codesJson', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    await repo.ensureSystemRoles(TENANT);

    const first = await repo.listRoles(TENANT);
    const system = first.filter((r) => r.isSystem === 1);
    expect(system).toHaveLength(4);
    const ids = system.map((r) => r.id).sort();
    const sa = system.find((r) => r.code === 'super_admin');
    expect(sa).toBeTruthy();
    if (!sa) return;

    await repo.updateRole(TENANT, sa.id, { codesJson: [] });

    await repo.ensureSystemRoles(TENANT);
    const second = await repo.listRoles(TENANT);
    const systemAfter = second.filter((r) => r.isSystem === 1);
    expect(systemAfter).toHaveLength(4);
    expect(systemAfter.map((r) => r.id).sort()).toEqual(ids);
    expect(systemAfter.find((r) => r.id === sa.id)?.codesJson).toEqual([]);
  });
});
