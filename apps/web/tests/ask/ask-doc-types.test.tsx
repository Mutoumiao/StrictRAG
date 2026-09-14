/**
 * 目标：文档类型必须读成员 GET /doc-types 关闭列表，禁止逗号自由输入当主路径。
 * 需求：功能表 §5.2 文档类型 · ADR-050 · 工单「文档类型成员面最小闭环」
 * 被测：AskPanel 类型关闭列表 · buildAskRequestBody
 * 简介：有枚举才出关闭列表；选一类型后 scope 为该码；空选项不写 scope；失败不挡提问。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildAskRequestBody } from '@/api/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();
const getAskModesMock = vi.fn();
const getKbDocTypesMock = vi.fn();

const hookState = {
  view: { type: 'idle' } as { type: 'idle' },
  lastFinal: null,
  busy: false,
};

let latestGetScope: (() => { docTypes?: string[] } | undefined) | undefined;

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
  useKnowledgeAsk: (opts: { getScope?: () => { docTypes?: string[] } | undefined }) => {
    latestGetScope = opts.getScope;
    return {
      view: hookState.view,
      setView: setViewMock,
      lastFinal: hookState.lastFinal,
      ask: askMock,
      reset: resetMock,
      stop: vi.fn(),
      busy: hookState.busy,
    };
  },
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
    getKbDocTypes: (kbId: string) => getKbDocTypesMock(kbId),
  };
});

import { AskPanel } from '@/components/ask-panel';

const KB = {
  id: '018f0000-0000-7000-8000-0000000000aa',
  tenantId: '018f0000-0000-7000-8000-000000000001',
  name: '演示库',
};

describe('AskPanel 文档类型', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    askMock.mockClear();
    latestGetScope = undefined;
    localStorage.clear();
    listKnowledgeBases.mockReset();
    getAskModesMock.mockReset();
    getKbDocTypesMock.mockReset();
    listKnowledgeBases.mockResolvedValue([KB]);
    getAskModesMock.mockResolvedValue({
      allowedModes: ['balanced'],
      defaultMode: 'balanced',
    });
    getKbDocTypesMock.mockResolvedValue({
      items: [
        { code: 'hr', label: 'hr' },
        { code: 'legal', label: 'legal' },
      ],
    });
    localStorage.setItem('strict-rag:web:last-kb-id', KB.id);
  });

  it('读枚举关闭列表；默认不收窄；选一类型后 scope 为该码', async () => {
    const user = userEvent.setup();
    render(<AskPanel />);
    await waitFor(() => expect(screen.getByLabelText('文档类型（可选）')).toBeInTheDocument());
    expect(getKbDocTypesMock).toHaveBeenCalledWith(KB.id);
    const trigger = screen.getByLabelText('文档类型（可选）');
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger).toHaveTextContent('不按类型收窄');
    expect(latestGetScope?.()).toBeUndefined();
    expect(buildAskRequestBody({ question: 'q', sessionId: null, scope: latestGetScope?.() }).scope).toBeUndefined();

    await user.click(trigger);
    expect(screen.getByRole('option', { name: 'hr' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'legal' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'hr' }));
    expect(screen.getByLabelText('文档类型（可选）')).toHaveTextContent('hr');
    expect(latestGetScope?.()).toEqual({ docTypes: ['hr'] });
    expect(
      buildAskRequestBody({ question: 'q', sessionId: null, scope: latestGetScope?.() }).scope,
    ).toEqual({ docTypes: ['hr'] });
    expect(screen.queryByPlaceholderText(/如 hr/)).not.toBeInTheDocument();
  });

  it('空枚举不出类型关闭列表', async () => {
    getKbDocTypesMock.mockResolvedValue({ items: [] });
    render(<AskPanel />);
    await waitFor(() => expect(getKbDocTypesMock).toHaveBeenCalledWith(KB.id));
    expect(screen.queryByLabelText('文档类型（可选）')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提问' })).toBeEnabled();
  });

  it('读取失败不挡提问、不传 scope', async () => {
    getKbDocTypesMock.mockRejectedValue(new Error('network'));
    render(<AskPanel />);
    await waitFor(() =>
      expect(screen.getByText('未能读取本库文档类型，提问将不按类型收窄。')).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText('文档类型（可选）')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '提问' })).toBeEnabled();
    expect(latestGetScope?.()).toBeUndefined();
  });
});
