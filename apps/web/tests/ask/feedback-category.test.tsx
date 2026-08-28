/**
 * 目标：答案反馈必须能提交报错与缺文档类别，不只赞/踩。
 * 需求：功能表 §3 答案反馈
 * 被测：AskPanel FeedbackBar
 * 简介：报错 → wrong_answer；缺文档 → missing_doc。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAnsweredFinal } from '@/test/fixtures/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const createAskFeedbackMock = vi.fn();

const hookState = {
  view: { type: 'idle' } as
    | { type: 'idle' }
    | { type: 'answered'; data: ReturnType<typeof makeAnsweredFinal> },
};

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
    view: hookState.view,
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

const listKnowledgeBases = vi.fn(async () => [] as { id: string; tenantId: string; name: string }[]);
vi.mock('@/api/knowledge-bases', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
}));

vi.mock('@/api/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/feedback')>();
  return {
    ...actual,
    createAskFeedback: (...args: unknown[]) => createAskFeedbackMock(...args),
  };
});

import { AskPanel } from '@/components/ask-panel';

describe('AskPanel 反馈类别', () => {
  beforeEach(() => {
    createAskFeedbackMock.mockReset();
    createAskFeedbackMock.mockResolvedValue({ feedbackId: 'f1' });
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([]);
    localStorage.clear();
  });

  it('报错提交 wrong_answer；缺文档提交 missing_doc', async () => {
    const user = userEvent.setup();
    const data = makeAnsweredFinal();
    hookState.view = { type: 'answered', data };
    render(<AskPanel />);
    await user.click(screen.getByRole('button', { name: '报错' }));
    await waitFor(() =>
      expect(createAskFeedbackMock).toHaveBeenCalledWith(data.requestId, {
        category: 'wrong_answer',
        rating: 'down',
      }),
    );
    expect(screen.getByText('已提交：报错')).toBeInTheDocument();
  });

  it('缺文档只提交 category=missing_doc', async () => {
    const user = userEvent.setup();
    const data = makeAnsweredFinal();
    hookState.view = { type: 'answered', data };
    render(<AskPanel />);
    await user.click(screen.getByRole('button', { name: '缺文档' }));
    await waitFor(() =>
      expect(createAskFeedbackMock).toHaveBeenCalledWith(data.requestId, {
        category: 'missing_doc',
      }),
    );
    expect(screen.getByText('已提交：缺文档')).toBeInTheDocument();
  });
});
