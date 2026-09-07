/**
 * 目标：角色页编辑超管时权限勾选与保存必须不可点并出说明，失败则可改少超管码。
 * 需求：功能表 §4.4 · ADR-056 · 工单「写路径锁超管全码」
 * 被测：RolesWorkspace · isLockedSuperAdminRole
 * 简介：HTTP 真值在 api 400 闸；本页只锁勾选与保存。其它角色仍可授码。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PermissionCatalogItem, PlatformRole } from '@strict-rag/contracts';

import { render, screen, userEvent } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'ops@test.local',
  permissions: [] as string[],
};

const loadRolesPage = vi.fn();
const createRole = vi.fn();
const saveRolePermissions = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/roles/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/roles/services')>();
  return {
    ...actual,
    loadRolesPage: (...args: unknown[]) => loadRolesPage(...args),
    createRole: (...args: unknown[]) => createRole(...args),
    saveRolePermissions: (...args: unknown[]) => saveRolePermissions(...args),
  };
});

import {
  isLockedSuperAdminRole,
  SUPER_ADMIN_CODES_LOCKED_HINT,
} from '@/app/(ops)/roles/services';
import { RolesWorkspace } from '@/app/(ops)/roles/_components/roles-workspace';

const SA_ID = '01900000-0000-7000-8000-0000000000d1';
const KB_ID = '01900000-0000-7000-8000-0000000000d2';

const catalog: PermissionCatalogItem[] = [
  {
    code: 'admin.shell',
    kind: 'page',
    scope: 'platform',
    description: '进入运营壳',
  },
  {
    code: 'role.perm.manage',
    kind: 'action',
    scope: 'platform',
    description: '管理角色绑码',
  },
];

const roles: PlatformRole[] = [
  {
    id: SA_ID,
    code: 'super_admin',
    name: '超级管理员',
    isSystem: true,
    enabled: true,
    codes: ['admin.shell', 'role.perm.manage'],
  },
  {
    id: KB_ID,
    code: 'kb_admin',
    name: '知识库管理员',
    isSystem: true,
    enabled: true,
    codes: ['admin.shell'],
  },
];

describe('isLockedSuperAdminRole', () => {
  it('只锁 super_admin 角色码', () => {
    expect(isLockedSuperAdminRole({ code: 'super_admin' })).toBe(true);
    expect(isLockedSuperAdminRole({ code: 'kb_admin' })).toBe(false);
    expect(isLockedSuperAdminRole(null)).toBe(false);
  });
});

describe('RolesWorkspace 超管全码锁', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'role.perm.manage'];
    loadRolesPage.mockReset();
    createRole.mockReset();
    saveRolePermissions.mockReset();
    loadRolesPage.mockResolvedValue({ ok: true, roles, catalog });
  });

  it('编辑超管：勾选与保存不可点，并出说明', async () => {
    const user = userEvent.setup();
    render(<RolesWorkspace />);
    await screen.findByText('超级管理员');
    const grantButtons = screen.getAllByRole('button', { name: '授码' });
    await user.click(grantButtons[0]!);

    expect(await screen.findByText(SUPER_ADMIN_CODES_LOCKED_HINT)).toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    expect(boxes.every((el) => (el as HTMLInputElement).disabled)).toBe(true);

    const save = screen.getByRole('button', { name: '保存权限' });
    expect(save).toBeDisabled();
    await user.click(save);
    expect(saveRolePermissions).not.toHaveBeenCalled();
  });

  it('编辑其它系统角色：勾选可点，保存可提交', async () => {
    const user = userEvent.setup();
    render(<RolesWorkspace />);
    await screen.findByText('知识库管理员');
    const grantButtons = screen.getAllByRole('button', { name: '授码' });
    await user.click(grantButtons[1]!);

    expect(screen.queryByText(SUPER_ADMIN_CODES_LOCKED_HINT)).not.toBeInTheDocument();
    const boxes = screen.getAllByRole('checkbox');
    expect(boxes.every((el) => !(el as HTMLInputElement).disabled)).toBe(true);

    saveRolePermissions.mockResolvedValue({
      ok: true,
      role: { ...roles[1]!, codes: ['admin.shell', 'role.perm.manage'] },
    });
    await user.click(screen.getByRole('button', { name: '保存权限' }));
    expect(saveRolePermissions).toHaveBeenCalled();
  });
});
