/**
 * 目标：用户页唯一在职超管的「禁用」和剥超管角色必须不可点并出说明，失败则仍可点到 API 400。
 * 需求：功能表 §4.4 · ADR-056 最后超管保护
 * 被测：UsersWorkspace · isLastActiveSuperAdmin · wouldStripLastSuperAdmin
 * 简介：列表判定末位；HTTP 真值仍在 api 400 闸，本页不改闸。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlatformRole, PlatformUser } from '@strict-rag/contracts';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'ops@test.local',
  permissions: [] as string[],
};

const loadUsers = vi.fn();
const createUser = vi.fn();
const updateUser = vi.fn();
const setUserRoles = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/users/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/users/services')>();
  return {
    ...actual,
    loadUsers: (...args: unknown[]) => loadUsers(...args),
    createUser: (...args: unknown[]) => createUser(...args),
    updateUser: (...args: unknown[]) => updateUser(...args),
    setUserRoles: (...args: unknown[]) => setUserRoles(...args),
  };
});

import {
  isLastActiveSuperAdmin,
  LAST_SUPER_ADMIN_HINT,
  wouldStripLastSuperAdmin,
} from '@/app/(ops)/users/services';
import { UsersWorkspace } from '@/app/(ops)/users/_components/users-workspace';

const SA_ROLE_ID = '01900000-0000-7000-8000-0000000000d1';
const KB_ROLE_ID = '01900000-0000-7000-8000-0000000000d2';
const ONLY_SA_ID = '01900000-0000-7000-8000-0000000000c1';
const OTHER_SA_ID = '01900000-0000-7000-8000-0000000000c2';
const OPS_ID = '01900000-0000-7000-8000-0000000000c3';

const roles: PlatformRole[] = [
  {
    id: SA_ROLE_ID,
    code: 'super_admin',
    name: '超级管理员',
    isSystem: true,
    enabled: true,
    codes: [],
  },
  {
    id: KB_ROLE_ID,
    code: 'kb_admin',
    name: '知识库管理员',
    isSystem: true,
    enabled: true,
    codes: [],
  },
];

function user(partial: Partial<PlatformUser> & Pick<PlatformUser, 'id' | 'email'>): PlatformUser {
  return {
    displayName: partial.displayName ?? null,
    status: partial.status ?? 'active',
    isPlatformOperator: partial.isPlatformOperator ?? true,
    roleIds: partial.roleIds ?? [],
    roleCodes: partial.roleCodes ?? [],
    ...partial,
  };
}

const onlySa = user({
  id: ONLY_SA_ID,
  email: 'only-sa@test.local',
  displayName: 'Only SA',
  roleIds: [SA_ROLE_ID],
  roleCodes: ['super_admin'],
});

const otherSa = user({
  id: OTHER_SA_ID,
  email: 'other-sa@test.local',
  displayName: 'Other SA',
  roleIds: [SA_ROLE_ID],
  roleCodes: ['super_admin'],
});

const opsUser = user({
  id: OPS_ID,
  email: 'ops@test.local',
  displayName: 'Ops',
  roleIds: [KB_ROLE_ID],
  roleCodes: ['kb_admin'],
});

describe('isLastActiveSuperAdmin / wouldStripLastSuperAdmin', () => {
  it('仅一名 active 超管时为末位', () => {
    expect(isLastActiveSuperAdmin([onlySa, opsUser], onlySa)).toBe(true);
    expect(isLastActiveSuperAdmin([onlySa, opsUser], opsUser)).toBe(false);
  });

  it('两名 active 超管时都不是末位', () => {
    expect(isLastActiveSuperAdmin([onlySa, otherSa], onlySa)).toBe(false);
    expect(isLastActiveSuperAdmin([onlySa, otherSa], otherSa)).toBe(false);
  });

  it('末位剥掉 super_admin 角色 id 会留下 0 名超管', () => {
    expect(wouldStripLastSuperAdmin([onlySa], ONLY_SA_ID, [], roles)).toBe(true);
    expect(wouldStripLastSuperAdmin([onlySa], ONLY_SA_ID, [KB_ROLE_ID], roles)).toBe(true);
    expect(wouldStripLastSuperAdmin([onlySa], ONLY_SA_ID, [SA_ROLE_ID, KB_ROLE_ID], roles)).toBe(
      false,
    );
  });

  it('两名超管时剥其一不为末位闸', () => {
    expect(wouldStripLastSuperAdmin([onlySa, otherSa], ONLY_SA_ID, [], roles)).toBe(false);
  });
});

describe('UsersWorkspace 末位超管提示', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'user.manage'];
    loadUsers.mockReset();
    createUser.mockReset();
    updateUser.mockReset();
    setUserRoles.mockReset();
  });

  it('唯一 active 超管：禁用不可点并出说明', async () => {
    loadUsers.mockResolvedValue({ ok: true, users: [onlySa, opsUser], roles });
    render(<UsersWorkspace />);

    const disableBtn = await screen.findByRole('button', { name: `禁用 ${onlySa.email}` });
    expect(disableBtn).toBeDisabled();
    expect(screen.getAllByText(LAST_SUPER_ADMIN_HINT).length).toBeGreaterThan(0);

    const userEvt = userEvent.setup();
    await userEvt.click(disableBtn);
    expect(updateUser).not.toHaveBeenCalled();

    const opsDisable = screen.getByRole('button', { name: `禁用 ${opsUser.email}` });
    expect(opsDisable).toBeEnabled();
  });

  it('唯一 active 超管：超管角色勾选不可点；仍可加其它角色并保存', async () => {
    loadUsers.mockResolvedValue({ ok: true, users: [onlySa], roles });
    setUserRoles.mockResolvedValue({
      ok: true,
      user: { ...onlySa, roleIds: [SA_ROLE_ID, KB_ROLE_ID], roleCodes: ['super_admin', 'kb_admin'] },
    });
    const userEvt = userEvent.setup();
    render(<UsersWorkspace />);

    await userEvt.click(await screen.findByRole('button', { name: `改角色 ${onlySa.email}` }));

    const saBox = await screen.findByLabelText('角色 super_admin');
    expect(saBox).toBeDisabled();
    expect(saBox).toBeChecked();
    expect(screen.getAllByText(LAST_SUPER_ADMIN_HINT).length).toBeGreaterThan(0);

    await userEvt.click(saBox);
    expect(saBox).toBeChecked();

    await userEvt.click(screen.getByLabelText('角色 kb_admin'));
    await userEvt.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(setUserRoles).toHaveBeenCalledWith(ONLY_SA_ID, {
        roleIds: [SA_ROLE_ID, KB_ROLE_ID],
      });
    });
  });

  it('两名 active 超管：可禁用其一', async () => {
    loadUsers.mockResolvedValue({ ok: true, users: [onlySa, otherSa], roles });
    updateUser.mockResolvedValue({ ok: true, user: { ...onlySa, status: 'disabled' } });
    const userEvt = userEvent.setup();
    render(<UsersWorkspace />);

    const disableBtn = await screen.findByRole('button', { name: `禁用 ${onlySa.email}` });
    expect(disableBtn).toBeEnabled();
    expect(screen.queryByText(LAST_SUPER_ADMIN_HINT)).not.toBeInTheDocument();

    await userEvt.click(disableBtn);
    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith(ONLY_SA_ID, { status: 'disabled' });
    });
  });

  it('两名 active 超管：可剥其一超管角色并保存', async () => {
    loadUsers.mockResolvedValue({ ok: true, users: [onlySa, otherSa], roles });
    setUserRoles.mockResolvedValue({
      ok: true,
      user: { ...onlySa, roleIds: [], roleCodes: [] },
    });
    const userEvt = userEvent.setup();
    render(<UsersWorkspace />);

    await userEvt.click(await screen.findByRole('button', { name: `改角色 ${onlySa.email}` }));
    const saBox = await screen.findByLabelText('角色 super_admin');
    expect(saBox).toBeEnabled();
    await userEvt.click(saBox);
    expect(saBox).not.toBeChecked();

    await userEvt.click(screen.getByRole('button', { name: '保存' }));
    await waitFor(() => {
      expect(setUserRoles).toHaveBeenCalledWith(ONLY_SA_ID, { roleIds: [] });
    });
  });
});
