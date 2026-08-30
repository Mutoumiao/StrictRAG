/**
 * 目标：知识库切换只能选本次可见库，禁止粘贴任意 uuid；列表失败不得当开通成员空态。
 * 需求：功能表 §3 知识库切换 · 工单「库选择器只列成员库」
 * 被测：AskPanel 知识库关闭列表
 * 简介：只能选 GET 返回的 id；脏缓存不提问；失败可重试且文案与空态可区分。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const getAskModesMock = vi.fn();

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
    ask: askMock,
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

vi.mock('@/api/ask', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/ask')>();
  return {
    ...actual,
    getAskModes: (kbId: string) => getAskModesMock(kbId),
  };
});

import { AskPanel } from '@/components/ask-panel';

const KB_A = {
  id: '018f0000-0000-7000-8000-0000000000aa',
  tenantId: '018f0000-0000-7000-8000-000000000001',
  name: '甲库',
};
const KB_B = {
  id: '018f0000-0000-7000-8000-0000000000bb',
  tenantId: '018f0000-0000-7000-8000-000000000001',
  name: '乙库',
};
const GHOST_ID = '018f0000-0000-7000-8000-0000000000ff';
const KB_STORAGE = 'strict-rag:web:last-kb-id';

describe('AskPanel 库选择器只列成员库', () => {
  beforeEach(() => {
    askMock.mockClear();
    getAskModesMock.mockReset();
    getAskModesMock.mockResolvedValue({
      allowedModes: ['balanced'],
      defaultMode: 'balanced',
    });
    localStorage.clear();
    listKnowledgeBases.mockReset();
  });

  it('列表失败无输入且可重试，文案不说开通成员', async () => {
    const user = userEvent.setup();
    listKnowledgeBases.mockRejectedValueOnce(new Error('forbidden'));
    render(<AskPanel />);
    await waitFor(() => {
      expect(screen.getByText('知识库列表加载失败')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toHaveTextContent(/无法获取可用知识库/);
    expect(screen.queryByText(/开通成员/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('知识库')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('知识库 ID')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '提问' })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('uuid')).not.toBeInTheDocument();

    listKnowledgeBases.mockResolvedValue([KB_A]);
    await user.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => {
      expect(screen.getByLabelText('知识库')).toBeInTheDocument();
    });
    expect(screen.queryByText('知识库列表加载失败')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('知识库'));
    expect(screen.getByRole('option', { name: '甲库' })).toBeInTheDocument();
  });

  it('只能选本次列表返回的 id，无自由输入', async () => {
    const user = userEvent.setup();
    listKnowledgeBases.mockResolvedValue([KB_A, KB_B]);
    render(<AskPanel />);
    const trigger = await screen.findByLabelText('知识库');
    expect(trigger.tagName).toBe('BUTTON');
    expect(document.querySelector('select')).toBeNull();
    expect(screen.queryByLabelText('知识库 ID')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('uuid')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提问' })).toBeDisabled();

    await user.click(trigger);
    expect(screen.getByRole('option', { name: '甲库' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '乙库' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: GHOST_ID })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '乙库' }));
    expect(screen.getByLabelText('知识库')).toHaveTextContent('乙库');
    expect(screen.getByRole('button', { name: '提问' })).toBeEnabled();
    expect(localStorage.getItem(KB_STORAGE)).toBe(KB_B.id);
  });

  it('脏缓存 id 不在本次列表中则不采用，不自动选第一项，不能提问', async () => {
    const user = userEvent.setup();
    localStorage.setItem(KB_STORAGE, GHOST_ID);
    listKnowledgeBases.mockResolvedValue([KB_A, KB_B]);
    render(<AskPanel />);
    const trigger = await screen.findByLabelText('知识库');
    expect(trigger).toHaveTextContent('请选择知识库');
    expect(trigger).not.toHaveTextContent('甲库');
    expect(getAskModesMock).not.toHaveBeenCalledWith(GHOST_ID);
    expect(screen.getByRole('button', { name: '提问' })).toBeDisabled();

    await user.type(screen.getByLabelText('问题'), '年假怎么休');
    await user.click(screen.getByRole('button', { name: '提问' }));
    expect(askMock).not.toHaveBeenCalled();
    expect(localStorage.getItem(KB_STORAGE)).toBe(GHOST_ID);
  });

  it('失败文案与空态文案可区分', async () => {
    listKnowledgeBases.mockRejectedValue(new Error('network'));
    const { unmount } = render(<AskPanel />);
    await waitFor(() => {
      expect(screen.getByText('知识库列表加载失败')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '重试' })).toBeInTheDocument();
    expect(screen.queryByText(/找管理员开通成员/)).not.toBeInTheDocument();
    unmount();

    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([]);
    render(<AskPanel />);
    await waitFor(() => {
      expect(screen.getByText(/找管理员开通成员/)).toBeInTheDocument();
    });
    expect(screen.queryByText('知识库列表加载失败')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('知识库')).not.toBeInTheDocument();
  });
});
