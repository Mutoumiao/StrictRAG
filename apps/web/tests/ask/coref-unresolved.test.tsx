/**
 * 目标：指代失败必须按业务拒答展示和操作，不得当系统崩溃，也不得写成连续追问卖点。
 * 需求：功能表 §3 建议动作 / 连续追问 rewrite · prds/04-pipelines/02-online-ask-langgraph.md §2.1
 * 被测：AskPanel AbstainedCard SuggestedActionBar
 * 简介：coref_unresolved 拒答卡 + 主按钮「用完整问题重述」回填不重发；禁止宣传准出。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAbstainedFinal } from '@/test/fixtures/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();

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

import { AskPanel } from '@/components/ask-panel';

const KB = { id: 'kb-1', tenantId: 't', name: '演示库' };
const WEAK_COREF = '还有呢？';
const COREF_MESSAGE = '未能确定您指的是哪一主题，请用完整问题重述（勿依赖「刚才/那个」）。';

function expectNoAdvertising() {
  const text = document.body.textContent ?? '';
  expect(text).not.toMatch(/已支持连续追问|已准出|多轮已启用/);
}

describe('AskPanel coref_unresolved 消费', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    hookState.lastFinal = null;
    hookState.busy = false;
    askMock.mockClear();
    localStorage.clear();
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([KB]);
  });

  it('拒答卡走 coref_unresolved；主按钮回填上次问句且不自动重发', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AskPanel />);
    await waitFor(() => expect(screen.getByRole('button', { name: '提问' })).toBeInTheDocument());
    await user.selectOptions(await screen.findByLabelText('知识库'), 'kb-1');
    await user.type(screen.getByLabelText('问题'), WEAK_COREF);
    await user.click(screen.getByRole('button', { name: '提问' }));
    await waitFor(() => expect(askMock).toHaveBeenCalledWith(WEAK_COREF));
    expect(screen.getByLabelText('问题')).toHaveValue('');

    hookState.view = {
      type: 'abstained',
      data: makeAbstainedFinal({
        reason: 'coref_unresolved',
        userMessage: COREF_MESSAGE,
        suggestedActions: [{ type: 'rephrase', label: '用完整问题重述' }],
      }),
    };
    rerender(<AskPanel />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/拒答/);
    expect(alert).toHaveTextContent(/coref_unresolved/);
    expect(alert).toHaveTextContent(COREF_MESSAGE);
    expect(alert).toHaveTextContent(/不是系统崩溃/);
    expect(alert).toHaveTextContent(/不会自动重发/);
    expect(alert.className).toMatch(/abstain/);
    expect(screen.queryByText(/系统错误/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重试' })).not.toBeInTheDocument();
    expectNoAdvertising();

    const primary = screen.getByRole('button', { name: '用完整问题重述' });
    expect(primary.className).toMatch(/bg-primary/);
    askMock.mockClear();
    await user.click(primary);

    expect(askMock).not.toHaveBeenCalled();
    expect(screen.getByLabelText('问题')).toHaveValue(WEAK_COREF);
    expect(screen.getByLabelText('问题')).toHaveFocus();
    expectNoAdvertising();
  });
});
