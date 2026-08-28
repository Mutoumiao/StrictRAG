/**
 * 目标：ask 429 RATE_LIMITED 必须出配额文案，不得装成已回答。
 * 需求：功能表 §3 配额/限流触顶
 * 被测：throwIfAskFailResponse · AskPanel ErrorCard
 * 简介：解析失败信封抛 RATE_LIMITED；错误卡标题为提问次数已达上限。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { throwIfAskFailResponse } from '@/api/ask';
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

const hookState = {
  view: { type: 'idle' } as
    | { type: 'idle' }
    | { type: 'error'; code: string; message: string; httpStatus?: number },
};

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

import { AskPanel } from '@/components/ask-panel';

describe('throwIfAskFailResponse', () => {
  it('429 RATE_LIMITED 抛 ApiHttpError', async () => {
    const res = new Response(
      JSON.stringify({
        ok: false,
        error: { code: 'RATE_LIMITED', message: 'ask rate limit exceeded' },
        meta: { requestId: 'r', timestamp: 't' },
      }),
      { status: 429, headers: { 'content-type': 'application/json' } },
    );
    await expect(throwIfAskFailResponse(res)).rejects.toMatchObject({
      name: 'ApiHttpError',
      code: 'RATE_LIMITED',
      message: 'ask rate limit exceeded',
      httpStatus: 429,
    });
  });

  it('2xx 不抛', async () => {
    const res = new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 });
    await expect(throwIfAskFailResponse(res)).resolves.toBeUndefined();
  });
});

describe('AskPanel 配额文案', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([]);
    localStorage.clear();
  });

  it('RATE_LIMITED 展示提问次数已达上限，不装 answered', async () => {
    hookState.view = {
      type: 'error',
      code: 'RATE_LIMITED',
      message: 'ask rate limit exceeded',
      httpStatus: 429,
    };
    render(<AskPanel />);
    await waitFor(() => expect(screen.getByText('提问次数已达上限')).toBeInTheDocument());
    expect(screen.getByText(/当前提问配额已用尽/)).toBeInTheDocument();
    expect(screen.getByText('RATE_LIMITED', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/已回答/)).not.toBeInTheDocument();
  });
});
