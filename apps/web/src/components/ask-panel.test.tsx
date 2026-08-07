/**
 * AskPanel 红线：lastQuestion 重试 · answered/abstained 语义。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAbstainedFinal, makeAnsweredFinal } from '@/test/fixtures/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();

const hookState = {
  view: { type: 'idle' } as
    | { type: 'idle' }
    | { type: 'loading'; phase?: string }
    | { type: 'answered'; data: ReturnType<typeof makeAnsweredFinal> }
    | { type: 'abstained'; data: ReturnType<typeof makeAbstainedFinal> }
    | { type: 'error'; code: string; message: string },
  lastFinal: null as ReturnType<typeof makeAnsweredFinal> | null,
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

import { AskPanel } from '@/components/ask-panel';

describe('AskPanel', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    hookState.lastFinal = null;
    hookState.busy = false;
    askMock.mockClear();
    resetMock.mockClear();
    localStorage.clear();
  });

  it('提交清空输入；error 重试用 lastQuestion', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AskPanel />);

    await user.type(screen.getByLabelText('知识库 ID'), 'kb-1');
    await user.type(screen.getByLabelText('问题'), '第一次问题');
    await user.click(screen.getByRole('button', { name: '提问' }));
    await waitFor(() => expect(askMock).toHaveBeenCalledWith('第一次问题'));
    expect(screen.getByLabelText('问题')).toHaveValue('');

    hookState.view = { type: 'error', code: 'INTERNAL', message: 'boom' };
    rerender(<AskPanel />);
    askMock.mockClear();
    await user.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(askMock).toHaveBeenCalledWith('第一次问题'));
  });

  it('R2: answered 展示引用；abstained 非系统错误', () => {
    hookState.view = { type: 'answered', data: makeAnsweredFinal() };
    const { rerender } = render(<AskPanel />);
    expect(screen.getByText('依据文档：答案正文')).toBeInTheDocument();
    expect(screen.getByText(/引用（服务端返回/)).toBeInTheDocument();

    hookState.view = { type: 'abstained', data: makeAbstainedFinal() };
    rerender(<AskPanel />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/拒答/);
    expect(alert).toHaveTextContent(/不是系统崩溃/);
    expect(alert.className).toMatch(/abstain/);
    expect(screen.queryByText(/系统错误/)).not.toBeInTheDocument();
  });
});
