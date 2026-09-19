/**
 * 目标：模型网关页的 Key 必须只写不回显：输入框是密码型、编辑时留空、请求体不夹带旧明文，列表只显示「已配置 Key」。
 * 需求：剧本 AD10 · prds/10-delivery/03-acceptance-scenarios.md · ADR-055
 * 被测：ModelsWorkspace
 * 简介：HTTP 真值在 api（GET 无明文见 gateway/bindings-http）。本页只断言掩码与不夹带。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-admin',
  email: 'admin@example.com',
  permissions: [] as string[],
};

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-admin', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

const loadModelGateway = vi.fn();
const createProvider = vi.fn();
const updateProvider = vi.fn();
const removeProvider = vi.fn();
const saveBindings = vi.fn();

vi.mock('@/app/(ops)/models/services', () => ({
  loadModelGateway: (...args: unknown[]) => loadModelGateway(...args),
  createProvider: (...args: unknown[]) => createProvider(...args),
  updateProvider: (...args: unknown[]) => updateProvider(...args),
  removeProvider: (...args: unknown[]) => removeProvider(...args),
  saveBindings: (...args: unknown[]) => saveBindings(...args),
}));

import { ModelsWorkspace } from '@/app/(ops)/models/_components/models-workspace';

const PROVIDER_ID = '01900000-0000-7000-8000-0000000000aa';

const provider = {
  id: PROVIDER_ID,
  name: 'DeepSeek',
  presetKey: 'deepseek' as const,
  baseUrl: 'https://api.deepseek.com',
  timeoutMs: 30_000,
  enabled: true,
  models: [
    { name: 'chat', type: 'llm' as const, enabled: true },
    { name: 'embed', type: 'embedding' as const, enabled: true, dimensions: 1024 },
  ],
  // 契约只暴露布尔，凭证本身不回读
  hasApiKey: true,
};

describe('ModelsWorkspace Key 掩码（AD10）', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'model.gateway.manage'];
    loadModelGateway.mockReset();
    createProvider.mockReset();
    updateProvider.mockReset();
    removeProvider.mockReset();
    saveBindings.mockReset();
    loadModelGateway.mockResolvedValue({
      ok: true,
      providers: [provider],
      presets: [
        {
          key: 'deepseek',
          label: 'DeepSeek',
          defaultBaseUrl: 'https://api.deepseek.com',
          supportsFetchModels: false,
        },
      ],
      catalog: [
        {
          ref: `${PROVIDER_ID}#chat`,
          providerId: PROVIDER_ID,
          providerName: 'DeepSeek',
          modelName: 'chat',
          type: 'llm',
        },
      ],
      bindings: {},
    });
    updateProvider.mockResolvedValue({ ok: true, provider });
  });

  it('列表只回「已配置 Key」，不出现任何明文凭证字段', async () => {
    render(<ModelsWorkspace />);

    expect(await screen.findByText(/已配置 Key/)).toBeInTheDocument();
    expect(screen.queryByText(/sk-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/apiKeyEnc/)).not.toBeInTheDocument();
  });

  it('API Key 输入为 password 型；编辑既有供应商时留空，保存不带 apiKey', async () => {
    const user = userEvent.setup();
    render(<ModelsWorkspace />);

    const keyInput = await screen.findByLabelText(/API Key/);
    expect(keyInput).toHaveAttribute('type', 'password');
    expect(keyInput).toHaveValue('');

    await user.click(await screen.findByRole('button', { name: '编辑' }));

    const editKey = screen.getByLabelText(/API Key/);
    expect(editKey).toHaveAttribute('type', 'password');
    expect(editKey).toHaveValue('');
    expect(editKey.getAttribute('placeholder')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '保存供应商' }));

    await waitFor(() => {
      expect(updateProvider).toHaveBeenCalledTimes(1);
    });
    const [id, body] = updateProvider.mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe(PROVIDER_ID);
    expect(body).not.toHaveProperty('apiKey');
    expect(JSON.stringify(body)).not.toContain('sk-');
  });

  it('无 model.gateway.manage → 页内 403 态，不发起加载', async () => {
    me.permissions = ['admin.shell'];
    render(<ModelsWorkspace />);

    expect(screen.getByText(/无 model\.gateway\.manage 权限/)).toBeInTheDocument();
    expect(loadModelGateway).not.toHaveBeenCalled();
  });
});
