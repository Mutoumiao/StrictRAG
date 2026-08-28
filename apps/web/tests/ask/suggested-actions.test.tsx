/**
 * 目标：拒答建议动作必须按 reason 出主按钮，而不是只做列表文案。
 * 需求：功能表 §3 建议动作
 * 被测：AskPanel AbstainedCard SuggestedActionBar
 * 简介：首项主按钮；换问法回填 lastQuestion；缺文档提交反馈类别。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAbstainedFinal } from '@/test/fixtures/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();
const createAskFeedbackMock = vi.fn();

const hookState = {
  view: { type: 'idle' } as
    | { type: 'idle' }
    | { type: 'abstained'; data: ReturnType<typeof makeAbstainedFinal> }
    | { type: 'error'; code: string; message: string },
  lastFinal: null as ReturnType<typeof makeAbstainedFinal> | null,
  busy: false,
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
    setView: setViewMock,
    lastFinal: hookState.lastFinal,
    ask: askMock,
    reset: resetMock,
    stop: vi.fn(),
    busy: hookState.busy,
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

vi.mock('@/api/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/feedback')>();
  return {
    ...actual,
    createAskFeedback: (...args: unknown[]) => createAskFeedbackMock(...args),
  };
});

import { AskPanel } from '@/components/ask-panel';

const KB = { id: 'kb-1', tenantId: 't', name: '演示库' };

describe('AskPanel 建议动作主按钮', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    hookState.lastFinal = null;
    hookState.busy = false;
    askMock.mockClear();
    createAskFeedbackMock.mockReset();
    createAskFeedbackMock.mockResolvedValue({ feedbackId: 'f1' });
    localStorage.clear();
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([KB]);
  });

  it('首项是主按钮；换问法回填上次问题', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AskPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: '提问' })).toBeInTheDocument());
    await user.type(screen.getByLabelText('知识库 ID'), 'kb-1');
    await user.type(screen.getByLabelText('问题'), '年假怎么休');
    await user.click(screen.getByRole('button', { name: '提问' }));
    await waitFor(() => expect(askMock).toHaveBeenCalledWith('年假怎么休'));

    hookState.view = {
      type: 'abstained',
      data: makeAbstainedFinal({
        reason: 'low_retrieval',
        suggestedActions: [
          { type: 'rephrase', label: '换种问法' },
          { type: 'contact_admin', label: '联系管理员' },
        ],
      }),
    };
    rerender(<AskPanel />);
    const primary = screen.getByRole('button', { name: '换种问法' });
    expect(primary.className).toMatch(/bg-primary/);
    await user.click(primary);
    expect(screen.getByLabelText('问题')).toHaveValue('年假怎么休');
  });

  it('反馈缺文档主按钮提交 missing_doc', async () => {
    const user = userEvent.setup();
    const data = makeAbstainedFinal({
      reason: 'model_abstained',
      suggestedActions: [{ type: 'feedback_missing_doc', label: '反馈缺文档' }],
    });
    hookState.view = { type: 'abstained', data };
    listKnowledgeBases.mockResolvedValue([KB]);
    render(<AskPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: '反馈缺文档' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: '反馈缺文档' }));
    await waitFor(() =>
      expect(createAskFeedbackMock).toHaveBeenCalledWith(data.requestId, {
        category: 'missing_doc',
      }),
    );
  });
});
