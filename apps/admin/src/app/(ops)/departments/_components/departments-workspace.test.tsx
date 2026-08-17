/**
 * 部门页：有 dept.manage 才露跨部门授权；删除走 removeGrant。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadDeptWorkspace = vi.fn();
const createDept = vi.fn();
const updateDept = vi.fn();
const removeDept = vi.fn();
const loadUserDepts = vi.fn();
const saveUserDepts = vi.fn();
const loadGrants = vi.fn();
const createGrant = vi.fn();
const removeGrant = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('../services', () => ({
  loadDeptWorkspace: (...args: unknown[]) => loadDeptWorkspace(...args),
  createDept: (...args: unknown[]) => createDept(...args),
  updateDept: (...args: unknown[]) => updateDept(...args),
  removeDept: (...args: unknown[]) => removeDept(...args),
  loadUserDepts: (...args: unknown[]) => loadUserDepts(...args),
  saveUserDepts: (...args: unknown[]) => saveUserDepts(...args),
  loadGrants: (...args: unknown[]) => loadGrants(...args),
  createGrant: (...args: unknown[]) => createGrant(...args),
  removeGrant: (...args: unknown[]) => removeGrant(...args),
}));

import { DepartmentsWorkspace } from './departments-workspace';

const GRANT_ID = '018f0000-0000-7000-8000-0000000000g1';
const USER_ID = '018f0000-0000-7000-8000-0000000000u1';
const DEPT_ID = '018f0000-0000-7000-8000-0000000000d1';

const grantRow = {
  id: GRANT_ID,
  userId: USER_ID,
  deptId: DEPT_ID,
  maxVisibilityLevel: 20 as const,
  expiresAt: null,
  reason: '临时',
  grantedAt: '2026-08-17 00:00:00',
};

describe('DepartmentsWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDeptWorkspace.mockReset();
    createDept.mockReset();
    updateDept.mockReset();
    removeDept.mockReset();
    loadUserDepts.mockReset();
    saveUserDepts.mockReset();
    loadGrants.mockReset();
    createGrant.mockReset();
    removeGrant.mockReset();
  });

  it('有 dept.manage：能看到授权块 + 新建控件', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue({ ok: true, tree: [], flat: [] });
    loadGrants.mockResolvedValue({ ok: true, grants: [] });

    render(<DepartmentsWorkspace />);

    expect(await screen.findByRole('heading', { name: '跨部门授权' })).toBeInTheDocument();
    expect(screen.getByLabelText('授权用户')).toBeInTheDocument();
    expect(screen.getByLabelText('授权部门')).toBeInTheDocument();
    expect(screen.getByLabelText('可见级')).toBeInTheDocument();
    expect(screen.getByLabelText('过期时间')).toBeInTheDocument();
    expect(screen.getByLabelText('原因')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建授权' })).toBeInTheDocument();
  });

  it('无 dept.manage：仍是现有 403 文案，看不到新建/删除', () => {
    me.permissions = [];

    render(<DepartmentsWorkspace />);

    expect(screen.getByText('403 · 无 dept.manage 权限')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '跨部门授权' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '新建授权' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除授权' })).not.toBeInTheDocument();
    expect(loadGrants).not.toHaveBeenCalled();
  });

  it('提交新建会调 createGrant', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue({ ok: true, tree: [], flat: [] });
    loadGrants.mockResolvedValue({ ok: true, grants: [] });
    createGrant.mockResolvedValue({ ok: true, grant: grantRow });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('授权用户'), USER_ID);
    await user.type(screen.getByLabelText('授权部门'), DEPT_ID);
    await user.click(screen.getByRole('button', { name: '新建授权' }));

    await waitFor(() => {
      expect(createGrant).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, deptId: DEPT_ID, maxVisibilityLevel: 20 }),
      );
    });
  });

  it('创建失败展示 API 文案', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue({ ok: true, tree: [], flat: [] });
    loadGrants.mockResolvedValue({ ok: true, grants: [] });
    createGrant.mockResolvedValue({ ok: false, message: 'VALIDATION_ERROR: expected uuid' });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('授权用户'), USER_ID);
    await user.type(screen.getByLabelText('授权部门'), DEPT_ID);
    await user.click(screen.getByRole('button', { name: '新建授权' }));

    expect(await screen.findByText(/VALIDATION_ERROR: expected uuid/)).toBeInTheDocument();
  });

  it('点删除会调 removeGrant', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue({ ok: true, tree: [], flat: [] });
    loadGrants.mockResolvedValue({ ok: true, grants: [grantRow] });
    removeGrant.mockResolvedValue({ ok: true });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '删除授权' }));

    await waitFor(() => {
      expect(removeGrant).toHaveBeenCalledWith(GRANT_ID);
    });
  });
});
