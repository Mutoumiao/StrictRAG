/**
 * 设置页：有 kb.config.write 可看/改 dataClass；无权限保持 403；sensitive ≠ 解禁。
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

vi.mock('../services', () => ({
  loadKbSettings: (...args: unknown[]) => loadKbSettings(...args),
  saveKbSettings: (...args: unknown[]) => saveKbSettings(...args),
}));

import { SettingsWorkspace } from './settings-workspace';

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
  qualitySnapshot: { tauClaim: 0.7 },
  sessionRewrite: { enabledDefault: false as const, locked: true as const },
};

describe('SettingsWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadKbSettings.mockReset();
    saveKbSettings.mockReset();
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

  it('页上可见 sensitive 不是已解禁的说明', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockResolvedValue({ ok: true, settings });

    render(<SettingsWorkspace />);

    expect(await screen.findByText(/不是已解禁/)).toBeInTheDocument();
    expect(screen.getByText(/解禁/)).toBeInTheDocument();
  });

  it('无 kb.config.write：保持 403 态，不展示设置面', async () => {
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
    me.permissions = ['admin.shell'];

    render(<SettingsWorkspace />);

    expect(screen.getByText('无 kb.config.write 权限（403）')).toBeInTheDocument();
    expect(screen.queryByLabelText('语料分级')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    expect(loadKbSettings).not.toHaveBeenCalled();
  });
});
