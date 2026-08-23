/**
 * 目标：KB 设置薄页必须按 kb.config.write 显隐，未改勾选不得 PATCH 强制/继承。
 * 需求：B2 设置 UI
 * 被测：SettingsWorkspace
 * 简介：mode 真值在 api。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-1',
  email: 'a@b.com',
  permissions: [] as string[],
};

const loadKbSettings = vi.fn();
const saveKbSettings = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

const loadKbBindings = vi.fn();
const saveKbBindings = vi.fn();

vi.mock('@/app/(ops)/kb/settings/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/kb/settings/services')>();
  return {
    ...actual,
    loadKbSettings: (...args: unknown[]) => loadKbSettings(...args),
    saveKbSettings: (...args: unknown[]) => saveKbSettings(...args),
    loadKbBindings: (...args: unknown[]) => loadKbBindings(...args),
    saveKbBindings: (...args: unknown[]) => saveKbBindings(...args),
  };
});

import { SettingsWorkspace } from '@/app/(ops)/kb/settings/_components/settings-workspace';

const KB_ID = '018f0000-0000-7000-8000-0000000000k1';

const settings = {
  kbId: KB_ID,
  name: '制度库',
  description: null,
  allowedModes: ['strict', 'balanced', 'fast'] as const,
  defaultMode: 'balanced' as const,
  docTypes: [],
  dataClass: 'internal' as const,
  deptInheritDown: true,
  deptAclEnforce: false,
  qualitySnapshot: { tauClaim: 0.7 },
  sessionRewrite: { enabledDefault: false as const, locked: true as const },
};

describe('SettingsWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadKbSettings.mockReset();
    saveKbSettings.mockReset();
    loadKbBindings.mockReset();
    saveKbBindings.mockReset();
    loadKbBindings.mockResolvedValue({ ok: true, bindings: {} });
    localStorage.clear();
  });

  it('有 kb.config.write：加载后可见当前 dataClass，保存 body 带 dataClass', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    saveKbSettings.mockResolvedValue({
      ok: true,
      settings: { ...settings, dataClass: 'sensitive' },
      text: '已保存',
    });

    render(<SettingsWorkspace />);
    const user = userEvent.setup();

    const select = await screen.findByLabelText('语料分级');
    expect(select).toHaveValue('internal');

    await user.selectOptions(select, 'sensitive');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveKbSettings).toHaveBeenCalledWith(KB_ID, {
        name: '制度库',
        description: null,
        allowedModes: ['strict', 'balanced', 'fast'],
        defaultMode: 'balanced',
        dataClass: 'sensitive',
      });
    });
    expect(screen.getByLabelText('语料分级')).toHaveValue('sensitive');
    expect(screen.getByText('已保存')).toBeInTheDocument();
  });

  it('加载后勾选反映 GET deptInheritDown: true', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });

    render(<SettingsWorkspace />);

    expect(await screen.findByRole('checkbox', { name: '上级看下级' })).toBeChecked();
  });

  it('不碰继承勾选就保存：PATCH 不带 deptInheritDown 键', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    saveKbSettings.mockResolvedValue({ ok: true, settings, text: '已保存' });

    render(<SettingsWorkspace />);
    const user = userEvent.setup();

    await screen.findByRole('checkbox', { name: '上级看下级' });
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveKbSettings).toHaveBeenCalledTimes(1);
    });
    const body = saveKbSettings.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({
      name: '制度库',
      description: null,
      allowedModes: ['strict', 'balanced', 'fast'],
      defaultMode: 'balanced',
      dataClass: 'internal',
    });
    expect(body).not.toHaveProperty('deptInheritDown');
    expect(body).not.toHaveProperty('deptAclEnforce');
  });

  it('取消「上级看下级」再保存：body 含 deptInheritDown: false', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    saveKbSettings.mockResolvedValue({
      ok: true,
      settings: { ...settings, deptInheritDown: false },
      text: '已保存',
    });

    render(<SettingsWorkspace />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: '上级看下级' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveKbSettings).toHaveBeenCalledWith(KB_ID, {
        name: '制度库',
        description: null,
        allowedModes: ['strict', 'balanced', 'fast'],
        defaultMode: 'balanced',
        dataClass: 'internal',
        deptInheritDown: false,
      });
    });
  });

  it('页上可见 sensitive 不是已解禁的说明', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });

    render(<SettingsWorkspace />);

    expect(await screen.findByText(/不是已解禁/)).toBeInTheDocument();
    expect(screen.getAllByText(/解禁/).length).toBeGreaterThan(0);
  });

  it('页上可见继承勾选不是打开强制隔离的说明', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });

    render(<SettingsWorkspace />);

    expect(await screen.findByText(/不是打开强制/)).toBeInTheDocument();
    expect(screen.getByText(/本库或进程/)).toBeInTheDocument();
  });

  it('无 kb.config.write：保持 403 态，不展示设置面', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell'];

    render(<SettingsWorkspace />);

    expect(screen.getByText('无 kb.config.write 权限（403）')).toBeInTheDocument();
    expect(screen.queryByLabelText('语料分级')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '上级看下级' })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: '本库打开部门强制' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(loadKbSettings).not.toHaveBeenCalled();
  });

  it('加载 GET deptAclEnforce: false →「本库打开部门强制」未勾', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });

    render(<SettingsWorkspace />);

    expect(await screen.findByRole('checkbox', { name: '本库打开部门强制' })).not.toBeChecked();
  });

  it('不碰强制勾选就保存：PATCH 不带 deptAclEnforce 键', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    saveKbSettings.mockResolvedValue({ ok: true, settings, text: '已保存' });

    render(<SettingsWorkspace />);
    const user = userEvent.setup();

    await screen.findByRole('checkbox', { name: '本库打开部门强制' });
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveKbSettings).toHaveBeenCalledTimes(1);
    });
    const body = saveKbSettings.mock.calls[0]![1] as Record<string, unknown>;
    expect(body).toEqual({
      name: '制度库',
      description: null,
      allowedModes: ['strict', 'balanced', 'fast'],
      defaultMode: 'balanced',
      dataClass: 'internal',
    });
    expect(body).not.toHaveProperty('deptAclEnforce');
    expect(body).not.toHaveProperty('deptInheritDown');
  });

  it('勾选「本库打开部门强制」再保存：body 含 deptAclEnforce: true', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    saveKbSettings.mockResolvedValue({
      ok: true,
      settings: { ...settings, deptAclEnforce: true },
      text: '已保存',
    });

    render(<SettingsWorkspace />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole('checkbox', { name: '本库打开部门强制' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveKbSettings).toHaveBeenCalledWith(KB_ID, {
        name: '制度库',
        description: null,
        allowedModes: ['strict', 'balanced', 'fast'],
        defaultMode: 'balanced',
        dataClass: 'internal',
        deptAclEnforce: true,
      });
    });
  });

  it('页上可见强制勾选不是仓库默认开的说明', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });

    render(<SettingsWorkspace />);

    expect(await screen.findByText(/不是仓库默认开/)).toBeInTheDocument();
    expect(screen.getByText(/覆盖进程 env/)).toBeInTheDocument();
    expect(screen.getByText(/不是解禁/)).toBeInTheDocument();
    expect(screen.getByText(/不是\s*ES/)).toBeInTheDocument();
  });
});
