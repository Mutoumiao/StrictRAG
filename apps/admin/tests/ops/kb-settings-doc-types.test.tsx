/**
 * 目标：知识库设置文档类型必须逐条增删改，禁止逗号串当主路径。
 * 需求：功能表 §4.2 文档类型 · ADR-054 · 工单「类型分区 CRUD 最小闭环」
 * 被测：SettingsWorkspace 类型分区
 * 简介：HTTP 真值在 api；本页只断言 PATCH 发 docTypeItems。
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
const loadKbSettingsAudit = vi.fn();
const loadKbBindings = vi.fn();
const saveKbBindings = vi.fn();
const loadModelCatalog = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/kb/settings/chunk-strategy.services', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/app/(ops)/kb/settings/chunk-strategy.services')>();
  return {
    ...actual,
    loadKbChunkStrategies: async () => ({ ok: true, items: [] }),
    saveKbChunkStrategies: async () => ({ ok: true, items: [] }),
  };
});

vi.mock('@/app/(ops)/kb/settings/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/kb/settings/services')>();
  return {
    ...actual,
    loadKbSettings: (...args: unknown[]) => loadKbSettings(...args),
    saveKbSettings: (...args: unknown[]) => saveKbSettings(...args),
    loadKbSettingsAudit: (...args: unknown[]) => loadKbSettingsAudit(...args),
    loadKbBindings: (...args: unknown[]) => loadKbBindings(...args),
    saveKbBindings: (...args: unknown[]) => saveKbBindings(...args),
    loadModelCatalog: (...args: unknown[]) => loadModelCatalog(...args),
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
  docTypes: ['hr'],
  docTypeItems: [{ code: 'hr', label: '人事', sort: 0, enabled: true }],
  dataClass: 'internal' as const,
  deptInheritDown: true,
  deptAclEnforce: false,
  qualitySnapshot: { tauClaim: 0.7 },
  sessionRewrite: { enabledDefault: false as const, locked: true as const },
};

describe('SettingsWorkspace 类型分区', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockReset();
    saveKbSettings.mockReset();
    loadKbSettingsAudit.mockReset();
    loadKbBindings.mockReset();
    saveKbBindings.mockReset();
    loadModelCatalog.mockReset();
    loadKbBindings.mockResolvedValue({ ok: true, bindings: {} });
    loadModelCatalog.mockResolvedValue({ ok: true, items: [] });
    loadKbSettingsAudit.mockResolvedValue({ ok: true, items: [] });
    localStorage.clear();
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
  });

  it('加载后可见现有行；新增一行保存 PATCH docTypeItems', async () => {
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    saveKbSettings.mockResolvedValue({
      ok: true,
      settings: {
        ...settings,
        docTypes: ['hr', 'legal'],
        docTypeItems: [
          { code: 'hr', label: '人事', sort: 0, enabled: true },
          { code: 'legal', label: '法务', sort: 1, enabled: true },
        ],
      },
      text: '已保存',
    });

    render(<SettingsWorkspace />);
    const user = userEvent.setup();

    expect(await screen.findByLabelText('码')).toHaveValue('hr');
    expect(screen.getByLabelText('显示名')).toHaveValue('人事');
    expect(screen.queryByPlaceholderText(/hr, legal/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '新增类型' }));
    const codes = screen.getAllByLabelText('码');
    const labels = screen.getAllByLabelText('显示名');
    await user.type(codes[1]!, 'legal');
    await user.type(labels[1]!, '法务');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(saveKbSettings).toHaveBeenCalledWith(
        KB_ID,
        expect.objectContaining({
          docTypeItems: [
            { code: 'hr', label: '人事', sort: 0, enabled: true },
            { code: 'legal', label: '法务', sort: 1, enabled: true },
          ],
        }),
      );
    });
    const body = saveKbSettings.mock.calls[0]?.[1] as { docTypes?: unknown };
    expect(body.docTypes).toBeUndefined();
  });
});
