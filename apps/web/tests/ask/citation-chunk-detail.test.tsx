/**
 * 目标：answered 引用卡片必须可点回当时分片快照，不得编造引用、不得走现网全文。
 * 需求：功能表 §5.2 引用回溯 · prds/05-api §2.9
 * 被测：AskPanel（CitationBlock）
 * 简介：点击引用调 GET /ask/:requestId；展示 snapshot preview；闲聊无点回。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAbstainedFinal, makeAnsweredFinal } from '@/test/fixtures/ask';
import { render, screen, userEvent, waitFor } from '@/test/test-utils';

const askMock = vi.fn(async () => undefined);
const resetMock = vi.fn();
const setViewMock = vi.fn();
const getAskAuditMock = vi.fn();

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

const listKnowledgeBases = vi.fn(async () => [] as { id: string; tenantId: string; name: string }[]);
vi.mock('@/api/knowledge-bases', () => ({
  listKnowledgeBases: () => listKnowledgeBases(),
}));

vi.mock('@/api/ask', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/ask')>();
  return {
    ...actual,
    getAskAudit: (requestId: string) => getAskAuditMock(requestId),
  };
});

import { AskPanel } from '@/components/ask-panel';

const SNAPSHOT_PREVIEW = '当时切片：年假须提前申请';

describe('AskPanel 引用点回', () => {
  beforeEach(() => {
    hookState.view = { type: 'idle' };
    hookState.lastFinal = null;
    hookState.busy = false;
    askMock.mockClear();
    resetMock.mockClear();
    getAskAuditMock.mockReset();
    localStorage.clear();
    listKnowledgeBases.mockReset();
    listKnowledgeBases.mockResolvedValue([]);
  });

  it('点击引用卡片按 requestId 拉取当时快照并展示分片详情', async () => {
    const user = userEvent.setup();
    const answered = makeAnsweredFinal();
    hookState.view = { type: 'answered', data: answered };
    getAskAuditMock.mockResolvedValue({
      requestId: answered.requestId,
      kbId: '018f0000-0000-7000-8000-0000000000aa',
      status: 'answered',
      reason: 'verified',
      evidenceSnapshot: [
        {
          chunkId: answered.citations[0]!.chunkId,
          docId: answered.citations[0]!.docId,
          title: '示例文档',
          lifecycle: 'active',
          preview: SNAPSHOT_PREVIEW,
        },
      ],
      graphTrace: { routeLabel: 'single' },
    });

    render(<AskPanel />);

    await user.click(screen.getByRole('button', { name: '示例文档' }));

    await waitFor(() => {
      expect(getAskAuditMock).toHaveBeenCalledWith(answered.requestId);
    });
    expect(screen.getByRole('region', { name: '分片详情' })).toBeInTheDocument();
    expect(screen.getByText(SNAPSHOT_PREVIEW)).toBeInTheDocument();
    expect(screen.getByText(/生命周期 active/)).toBeInTheDocument();
  });

  it('回溯失败时展示错误，不得编造分片正文', async () => {
    const user = userEvent.setup();
    hookState.view = { type: 'answered', data: makeAnsweredFinal() };
    getAskAuditMock.mockRejectedValue(new Error('ask trace not found'));

    render(<AskPanel />);
    await user.click(screen.getByRole('button', { name: '示例文档' }));

    await waitFor(() => {
      expect(screen.getByText('ask trace not found')).toBeInTheDocument();
    });
    expect(screen.queryByRole('region', { name: '分片详情' })).not.toBeInTheDocument();
  });

  it('闲聊路径不展示可点回引用', () => {
    hookState.view = {
      type: 'answered',
      data: makeAnsweredFinal({ answerKind: 'chitchat', reason: 'chitchat' }),
    };
    render(<AskPanel />);
    expect(screen.queryByRole('button', { name: '示例文档' })).not.toBeInTheDocument();
    expect(screen.getByText(/闲聊路径，无知识库引用/)).toBeInTheDocument();
  });
});
