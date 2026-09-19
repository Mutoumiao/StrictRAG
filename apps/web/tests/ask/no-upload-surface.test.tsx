/**
 * 目标：web 用户端问答面不得露出上传/写入入口；即便误露，写 API 仍由服务端 403（剧本 S9 双罪）。
 * 需求：剧本 S9 · prds/10-delivery/03-acceptance-scenarios.md · ADR-045 焊死 #2（UI≠API）
 * 被测：AskPanel（本包只测界面适配，不重算服务端权限）
 * 简介：有可见知识库时页面只剩提问相关控件，无上传钮 / 文件选择器 / 文档管理入口。API 侧 403 真值见 apps/api/tests/auth/enforce-permission-matrix.test.ts。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/test/test-utils';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/components/auth-guard', () => ({
  useWebAuth: () => ({
    me: { userId: 'u-1', email: 'user@example.com', permissions: [] },
    session: { sessionId: 's-1', userId: 'u-1', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-knowledge-ask', () => ({
  useKnowledgeAsk: () => ({
    view: { type: 'idle' },
    setView: vi.fn(),
    lastFinal: null,
    ask: vi.fn(),
    reset: vi.fn(),
    stop: vi.fn(),
    busy: false,
  }),
}));

vi.mock('@/services/sessions.services', () => ({
  loadSessionList: vi.fn(async () => ({ ok: true, sessions: [] })),
  loadSessionHistory: vi.fn(async () => ({ ok: true, messages: [] })),
  createNewSession: vi.fn(async () => ({
    ok: true,
    sessionId: '018f0000-0000-7000-8000-0000000000ee',
  })),
  refreshAfterAskFinal: vi.fn(async () => ({ sessionId: null, history: [], sessions: [] })),
}));

vi.mock('@/auth/services', () => ({
  logoutLocal: vi.fn(),
}));

const listKnowledgeBases = vi.fn();
vi.mock('@/api/knowledge-bases', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
}));

const getAskModesMock = vi.fn();
const getKbDocTypesMock = vi.fn();
vi.mock('@/api/ask', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/ask')>();
  return {
    ...actual,
    getAskModes: (kbId: string) => getAskModesMock(kbId),
    getKbDocTypes: (kbId: string) => getKbDocTypesMock(kbId),
  };
});

import { AskPanel } from '@/components/ask-panel';

const KB = {
  id: '018f0000-0000-7000-8000-0000000000aa',
  tenantId: '018f0000-0000-7000-8000-000000000001',
  name: '甲库',
};

describe('AskPanel 无上传/写入入口（S9）', () => {
  beforeEach(() => {
    localStorage.clear();
    listKnowledgeBases.mockReset();
    getAskModesMock.mockReset();
    getKbDocTypesMock.mockReset();
    getAskModesMock.mockResolvedValue({ allowedModes: ['balanced'], defaultMode: 'balanced' });
    getKbDocTypesMock.mockResolvedValue({ items: [] });
    listKnowledgeBases.mockResolvedValue([KB]);
  });

  it('页面可用但没有任何上传 / 文档写入入口', async () => {
    render(<AskPanel />);

    // 先证页面确实渲染出来（否则「没有上传钮」是空转）
    await waitFor(() => {
      expect(screen.getByLabelText('知识库')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '提问' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: /上传|导入|新建文档|写入/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /上传|导入|新建文档|写入/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/上传|选择文件/)).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });
});
