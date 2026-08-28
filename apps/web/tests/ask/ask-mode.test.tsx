/**
 * 目标：问答档位必须读库 allowedModes/defaultMode 并传 mode，客户端不可改阈值。
 * 需求：功能表 §3 问答档位
 * 被测：AskPanel 档位下拉 · buildAskRequestBody
 * 简介：下拉只列允许档；默认选 defaultMode；body.options.mode 白名单字段。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAskRequestBody } from '@/api/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();
const getAskModesMock = vi.fn();

const hookState = {
  view: { type: 'idle' } as { type: 'idle' },
  lastFinal: null,
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

vi.mock('@/api/ask', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/ask')>();
  return {
    ...actual,
    getAskModes: (kbId: string) => getAskModesMock(kbId),
  };
});

import { AskPanel } from '@/components/ask-panel';

const KB = {
  id: '018f0000-0000-7000-8000-0000000000aa',
  tenantId: '018f0000-0000-7000-8000-000000000001',
  name: '演示库',
};

describe('buildAskRequestBody mode', () => {
  it('无 mode 不写 options.mode', () => {
    expect(buildAskRequestBody({ question: 'q', sessionId: null }).options).toEqual({
      stream: true,
    });
  });
});

describe('AskPanel 档位', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    askMock.mockClear();
    localStorage.clear();
    listKnowledgeBases.mockReset();
    getAskModesMock.mockReset();
    listKnowledgeBases.mockResolvedValue([KB]);
    getAskModesMock.mockResolvedValue({
      allowedModes: ['strict', 'fast'],
      defaultMode: 'fast',
    });
    localStorage.setItem('strict-rag:web:last-kb-id', KB.id);
  });

  it('读 allowedModes，默认 defaultMode，不展示未允许档', async () => {
    const user = userEvent.setup();
    render(<AskPanel />);
    await waitFor(() => expect(screen.getByLabelText('问答档位')).toBeInTheDocument());
    expect(getAskModesMock).toHaveBeenCalledWith(KB.id);
    const select = screen.getByLabelText('问答档位');
    expect(select).toHaveValue('fast');
    expect(screen.getByRole('option', { name: /快速/ })).toHaveValue('fast');
    expect(screen.getByRole('option', { name: /严谨/ })).toHaveValue('strict');
    expect(screen.queryByRole('option', { name: /均衡/ })).not.toBeInTheDocument();
    await user.selectOptions(select, 'strict');
    expect(select).toHaveValue('strict');
  });
});
