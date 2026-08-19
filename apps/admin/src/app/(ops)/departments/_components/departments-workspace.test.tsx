/**
 * 部门页：有 dept.manage 才露跨部门授权；有 user.manage 才露归属写入口。
 * 双码时授权用户下拉；仅 dept.manage 仍 uuid 粘贴。
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
const loadGrantUsers = vi.fn();
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
  loadGrantUsers: (...args: unknown[]) => loadGrantUsers(...args),
  createGrant: (...args: unknown[]) => createGrant(...args),
  removeGrant: (...args: unknown[]) => removeGrant(...args),
}));

import { DepartmentsWorkspace } from './departments-workspace';

const GRANT_ID = '018f0000-0000-7000-8000-0000000000g1';
const USER_ID = '018f0000-0000-7000-8000-0000000000u1';
const DISABLED_USER_ID = '018f0000-0000-7000-8000-0000000000u2';
const DEPT_ID = '018f0000-0000-7000-8000-0000000000d1';
const DISABLED_DEPT_ID = '018f0000-0000-7000-8000-0000000000d2';

const activeDept = {
  id: DEPT_ID,
  parentId: null,
  name: '人事部',
  sort: 0,
  status: 'active' as const,
};

const disabledDept = {
  id: DISABLED_DEPT_ID,
  parentId: null,
  name: '已禁用部',
  sort: 1,
  status: 'disabled' as const,
};

const workspaceWithDepts = {
  ok: true as const,
  tree: [
    { ...activeDept, children: [] },
    { ...disabledDept, children: [] },
  ],
  flat: [activeDept, disabledDept],
};

const grantRow = {
  id: GRANT_ID,
  userId: USER_ID,
  deptId: DEPT_ID,
  maxVisibilityLevel: 20 as const,
  expiresAt: null,
  reason: '临时',
  grantedAt: '2026-08-17 00:00:00',
};

const activeUser = {
  id: USER_ID,
  email: 'zhang@example.com',
  displayName: '张三',
  status: 'active' as const,
  isPlatformOperator: true,
  roleIds: [] as string[],
  roleCodes: [] as string[],
};

const disabledUser = {
  id: DISABLED_USER_ID,
  email: 'disabled@example.com',
  displayName: '已禁用用户',
  status: 'disabled' as const,
  isPlatformOperator: true,
  roleIds: [] as string[],
  roleCodes: [] as string[],
};

function grantUserSelect() {
  return screen.getByLabelText('授权用户') as HTMLSelectElement;
}

function grantUserOptionTexts() {
  return [...grantUserSelect().options].map((o) => o.textContent);
}

function grantDeptSelect() {
  return screen.getByLabelText('授权部门') as HTMLSelectElement;
}

function grantDeptOptionTexts() {
  return [...grantDeptSelect().options].map((o) => o.textContent);
}

function assignDeptSelect() {
  return screen.getByLabelText('设为所属部门（单条主归属，覆盖）') as HTMLSelectElement;
}

function assignDeptOptionTexts() {
  return [...assignDeptSelect().options].map((o) => o.textContent);
}

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
    loadGrantUsers.mockReset();
    createGrant.mockReset();
    removeGrant.mockReset();
    loadGrantUsers.mockResolvedValue({ ok: true, users: [] });
  });

  it('有 dept.manage：能看到授权块 + 新建控件', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue({ ok: true, tree: [], flat: [] });
    loadGrants.mockResolvedValue({ ok: true, grants: [] });

    render(<DepartmentsWorkspace />);

    expect(await screen.findByRole('heading', { name: '跨部门授权' })).toBeInTheDocument();
    expect(screen.getByLabelText('授权用户')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '授权用户' })).toBeInTheDocument();
    expect(screen.getByLabelText('授权部门')).toBeInTheDocument();
    expect(grantDeptSelect().tagName).toBe('SELECT');
    expect(screen.getByRole('combobox', { name: '授权部门' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '授权部门' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('可见级')).toBeInTheDocument();
    expect(screen.getByLabelText('过期时间')).toBeInTheDocument();
    expect(screen.getByLabelText('原因')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '新建授权' })).toBeInTheDocument();
  });

  it('授权部门下拉只有 active 部门', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({
      ok: true,
      grants: [{ ...grantRow, deptId: DISABLED_DEPT_ID }],
    });

    render(<DepartmentsWorkspace />);

    await waitFor(() => {
      expect(grantDeptOptionTexts()).toContain('人事部');
    });
    expect(grantDeptOptionTexts()).not.toContain('已禁用部');
    expect(grantDeptOptionTexts()).toContain('选择部门');
    expect(await screen.findByText(`deptId ${DISABLED_DEPT_ID}`)).toBeInTheDocument();
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
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });
    createGrant.mockResolvedValue({ ok: true, grant: grantRow });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('授权用户'), USER_ID);
    await waitFor(() => {
      expect(grantDeptOptionTexts()).toContain('人事部');
    });
    await user.selectOptions(grantDeptSelect(), DEPT_ID);
    await user.click(screen.getByRole('button', { name: '新建授权' }));

    await waitFor(() => {
      expect(createGrant).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, deptId: DEPT_ID, maxVisibilityLevel: 20 }),
      );
    });
  });

  it('创建失败展示 API 文案', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });
    createGrant.mockResolvedValue({ ok: false, message: 'VALIDATION_ERROR: expected uuid' });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('授权用户'), USER_ID);
    await waitFor(() => {
      expect(grantDeptOptionTexts()).toContain('人事部');
    });
    await user.selectOptions(grantDeptSelect(), DEPT_ID);
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

  it('有 user.manage：归属部门是 select，用户 ID 仍是 textbox', async () => {
    me.permissions = ['dept.manage', 'user.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });

    render(<DepartmentsWorkspace />);

    expect(await screen.findByRole('heading', { name: '用户归属（需 user.manage）' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '用户 ID' })).toBeInTheDocument();
    expect(assignDeptSelect().tagName).toBe('SELECT');
    expect(
      screen.getByRole('combobox', { name: '设为所属部门（单条主归属，覆盖）' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: '设为所属部门（单条主归属，覆盖）' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '保存归属' })).toBeInTheDocument();
  });

  it('归属部门下拉只有 active 部门', async () => {
    me.permissions = ['dept.manage', 'user.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });

    render(<DepartmentsWorkspace />);

    await waitFor(() => {
      expect(assignDeptOptionTexts()).toContain('人事部');
    });
    expect(assignDeptOptionTexts()).not.toContain('已禁用部');
    expect(assignDeptOptionTexts()).toContain('选择部门');
  });

  it('选部门并保存会调 saveUserDepts', async () => {
    me.permissions = ['dept.manage', 'user.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });
    saveUserDepts.mockResolvedValue({ ok: true, view: { assignments: [] } });
    loadUserDepts.mockResolvedValue({ ok: true, view: { assignments: [] } });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('用户 ID'), USER_ID);
    await waitFor(() => {
      expect(assignDeptOptionTexts()).toContain('人事部');
    });
    await user.selectOptions(assignDeptSelect(), DEPT_ID);
    await user.click(screen.getByRole('button', { name: '保存归属' }));

    await waitFor(() => {
      expect(saveUserDepts).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({
          assignments: [expect.objectContaining({ deptId: DEPT_ID })],
        }),
      );
    });
  });

  it('有 dept.manage 且 user.manage：授权用户是下拉，禁用用户不在选项，提交带 uuid', async () => {
    me.permissions = ['dept.manage', 'user.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });
    loadGrantUsers.mockResolvedValue({ ok: true, users: [activeUser, disabledUser] });
    createGrant.mockResolvedValue({ ok: true, grant: grantRow });

    render(<DepartmentsWorkspace />);
    const user = userEvent.setup();

    const field = await screen.findByLabelText('授权用户');
    expect(field.tagName).toBe('SELECT');
    expect(screen.getByRole('combobox', { name: '授权用户' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '授权用户' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(grantUserOptionTexts()).toContain('张三');
    });
    expect(grantUserOptionTexts()).not.toContain('已禁用用户');
    expect(grantUserOptionTexts()).not.toContain('disabled@example.com');
    expect(grantUserOptionTexts()).toContain('选择用户');

    await user.selectOptions(grantUserSelect(), USER_ID);
    await waitFor(() => {
      expect(grantDeptOptionTexts()).toContain('人事部');
    });
    await user.selectOptions(grantDeptSelect(), DEPT_ID);
    await user.click(screen.getByRole('button', { name: '新建授权' }));

    await waitFor(() => {
      expect(createGrant).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, deptId: DEPT_ID, maxVisibilityLevel: 20 }),
      );
    });
  });

  it('仅 dept.manage：授权用户仍是文本框，不请求用户列表', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });

    render(<DepartmentsWorkspace />);

    expect(await screen.findByRole('textbox', { name: '授权用户' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '授权用户' })).not.toBeInTheDocument();
    expect(loadGrantUsers).not.toHaveBeenCalled();
  });

  it('有用户列表时授权行显示名而非只 uuid', async () => {
    me.permissions = ['dept.manage', 'user.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [grantRow] });
    loadGrantUsers.mockResolvedValue({ ok: true, users: [activeUser, disabledUser] });

    render(<DepartmentsWorkspace />);

    expect(await screen.findByText('userId 张三')).toBeInTheDocument();
    expect(screen.queryByText(`userId ${USER_ID}`)).not.toBeInTheDocument();
  });

  it('无 user.manage：不露保存归属', async () => {
    me.permissions = ['dept.manage'];
    loadDeptWorkspace.mockResolvedValue(workspaceWithDepts);
    loadGrants.mockResolvedValue({ ok: true, grants: [] });

    render(<DepartmentsWorkspace />);

    expect(await screen.findByRole('heading', { name: '跨部门授权' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '用户归属（需 user.manage）' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存归属' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('用户 ID')).not.toBeInTheDocument();
  });
});
