/**
 * 目标：知识库设置页必须展示本库修改日志；无行时须出「暂无修改日志」。
 * 需求：功能表 §4.2 修改日志
 * 被测：SettingsWorkspace
 * 简介：mock services，不打真 HTTP；有行展示时间 / 操作者 / 字段旧→新。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@/test/test-utils';
import type { KbSettingsAuditItem } from '@strict-rag/contracts';

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

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/kb/settings/services', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/app/(ops)/kb/settings/services')>();
  return {
    ...actual,
    loadKbSettings: (...args: unknown[]) => loadKbSettings(...args),
    saveKbSettings: (...args: unknown[]) => saveKbSettings(...args),
    loadKbSettingsAudit: (...args: unknown[]) => loadKbSettingsAudit(...args),
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

const auditRow: KbSettingsAuditItem = {
  id: '01900000-0000-7000-8000-0000000000a1',
  kbId: KB_ID,
  actorUserId: 'u-admin',
  createdAt: '2026-09-07 12:00:00',
  diff: {
    name: { from: '制度库', to: 'Renamed' },
  },
};

describe('SettingsWorkspace 修改日志', () => {
  beforeEach(() => {
    me.permissions = ['admin.shell', 'kb.config.write'];
    loadKbSettings.mockReset();
    saveKbSettings.mockReset();
    loadKbSettingsAudit.mockReset();
    loadKbBindings.mockReset();
    saveKbBindings.mockReset();
    loadKbBindings.mockResolvedValue({ ok: true, bindings: {} });
    loadKbSettings.mockResolvedValue({ ok: true, settings });
    localStorage.clear();
    localStorage.setItem('strict-rag:admin:last-kb-id', KB_ID);
  });

  it('无行显示暂无修改日志', async () => {
    loadKbSettingsAudit.mockResolvedValue({ ok: true, items: [] });
    render(<SettingsWorkspace />);
    expect(await screen.findByRole('heading', { name: '修改日志' })).toBeInTheDocument();
    expect(screen.getByText('暂无修改日志')).toBeInTheDocument();
    expect(loadKbSettingsAudit).toHaveBeenCalledWith(KB_ID);
  });

  it('有行展示时间、操作者、字段旧→新', async () => {
    loadKbSettingsAudit.mockResolvedValue({ ok: true, items: [auditRow] });
    render(<SettingsWorkspace />);
    expect(await screen.findByText(/2026-09-07 12:00:00/)).toBeInTheDocument();
    expect(screen.getByText(/u-admin/)).toBeInTheDocument();
    expect(screen.getByText(/name：制度库 → Renamed/)).toBeInTheDocument();
    expect(screen.queryByText('暂无修改日志')).not.toBeInTheDocument();
  });
});
