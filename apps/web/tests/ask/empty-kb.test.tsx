/**
 * 目标：无可用知识库时必须阻断提问，引导找管理员开通成员。
 * 需求：功能表 §3 无可用知识库
 * 被测：AskPanel 空态
 * 简介：列表成功且为空则无提问表；列表失败仍可粘贴（选择器半接线不在本工单）。
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
  refreshAfterAskFinal: vi.fn(async () => ({
    sessionId: null,
    history: [],
    sessions: [],
  })),
}));

vi.mock('@/auth/services', () => ({
  logoutLocal: vi.fn(),
}));

const listKnowledgeBases = vi.fn();
vi.mock('@/api/knowledge-bases', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
}));

import { AskPanel } from '@/components/ask-panel';

describe('AskPanel 无可用库空态', () => {
  beforeEach(() => {
    localStorage.clear();
    listKnowledgeBases.mockReset();
  });

  it('可见库为空时阻断提问并提示找管理员开通成员', async () => {
    listKnowledgeBases.mockResolvedValue([]);
    render(<AskPanel />);
    await waitFor(() => {
      expect(screen.getByText(/找管理员开通成员/)).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: '提问' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('知识库 ID')).not.toBeInTheDocument();
  });
});
