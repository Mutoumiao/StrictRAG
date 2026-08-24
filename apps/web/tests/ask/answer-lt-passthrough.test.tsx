/**
 * 目标：制度答案含 `a < b` 或 `<工号>` 必须原样可见，不得被剥掉或当 HTML 标签吃掉。
 * 需求：K6
 * 被测：AskPanel（AnsweredCard 文本节点）
 * 简介：答案走 React 文本节点，小于号与尖括号工号原样展示。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAnsweredFinal } from '@/test/fixtures/ask';
import { render, screen } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();

const POLICY_ANSWER = '当 a < b 时填写 <工号>';

const hookState = {
  view: { type: 'idle' } as
    | { type: 'idle' }
    | { type: 'loading'; phase?: string }
    | { type: 'answered'; data: ReturnType<typeof makeAnsweredFinal> }
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

const listKnowledgeBases = vi.fn(async () => [] as { id: string; tenantId: string; name: string }[]);
vi.mock('@/api/knowledge-bases', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
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
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([]);
  });

  it('K6: 制度答案含 a < b 与 <工号> 原样可见', () => {
    hookState.view = {
      type: 'answered',
      data: makeAnsweredFinal({ answer: POLICY_ANSWER }),
    };
    render(<AskPanel />);

    expect(screen.getByText(POLICY_ANSWER)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('a < b');
    expect(screen.getByRole('alert')).toHaveTextContent('<工号>');
  });
});
