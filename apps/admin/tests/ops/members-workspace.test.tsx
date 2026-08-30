/**
 * 目标：成员页有 member.manage 才能改角色；改下拉须走 PUT 用例。
 * 需求：prds/05-api §2.2 · 功能表 §5.2 成员
 * 被测：MembersWorkspace
 * 简介：HTTP 真值在 api；本页只测改角色入口。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadMemberList = vi.fn();
const inviteKbMemberAndReload = vi.fn();
const updateKbMemberRoleAndReload = vi.fn();
const removeKbMemberAndReload = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/members/services', () => ({
  loadMemberList: (...args: unknown[]) => loadMemberList(...args),
  inviteKbMemberAndReload: (...args: unknown[]) => inviteKbMemberAndReload(...args),
  updateKbMemberRoleAndReload: (...args: unknown[]) => updateKbMemberRoleAndReload(...args),
  removeKbMemberAndReload: (...args: unknown[]) => removeKbMemberAndReload(...args),
}));

import { MembersWorkspace } from '@/app/(ops)/members/_components/members-workspace';

const KB = '01900000-0000-7000-8000-0000000000aa';
const USER = '01900000-0000-7000-8000-0000000000b1';

describe('MembersWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadMemberList.mockReset();
    inviteKbMemberAndReload.mockReset();
    updateKbMemberRoleAndReload.mockReset();
    removeKbMemberAndReload.mockReset();
    localStorage.clear();
  });

  it('无 member.manage 显示错误，不请求列表', async () => {
    me.permissions = ['admin.shell'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    render(<MembersWorkspace />);
    expect(await screen.findByText(/无 member.manage 权限/)).toBeInTheDocument();
    expect(loadMemberList).not.toHaveBeenCalled();
  });

  it('有码可改角色并刷新列表', async () => {
    me.permissions = ['admin.shell', 'member.manage'];
    localStorage.setItem('strict-rag:admin:last-kb-id', KB);
    loadMemberList.mockResolvedValue({
      ok: true,
      rows: [
        {
          kbId: KB,
          userId: USER,
          role: 'read',
          email: 'reader@test.local',
        },
      ],
    });
    updateKbMemberRoleAndReload.mockResolvedValue({
      ok: true,
      text: '已改角色',
      rows: [
        {
          kbId: KB,
          userId: USER,
          role: 'write',
          email: 'reader@test.local',
        },
      ],
    });

    const user = userEvent.setup();
    render(<MembersWorkspace />);
    const select = (await screen.findByLabelText('成员角色 reader@test.local')) as HTMLSelectElement;
    expect(select.value).toBe('read');

    await user.selectOptions(select, 'write');
    await waitFor(() => {
      expect(updateKbMemberRoleAndReload).toHaveBeenCalledWith(KB, USER, 'write');
    });
    expect(await screen.findByText('已改角色')).toBeInTheDocument();
  });
});
