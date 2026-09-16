/**
 * 目标：ask 流式断线后必须按 requestId 重拉该轮终态，读不回时明说不可用，禁止当成已回答。
 * 需求：prds/05-api §2.7 连接中断重拉 · 功能表 §3 流式回答
 * 被测：useKnowledgeAsk（onError / recoverFinal / getRequestId）
 * 简介：断线重拉终态；404 或 ready=false → unavailable；429 不重拉；每轮换新请求号且不重发提问。
 */

import type { AskFinalResponse } from '@strict-rag/contracts';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAnsweredFinal } from '@/test/fixtures/ask';

type ChatStatus = 'ready' | 'submitted' | 'streaming' | 'error';

const chat = {
  status: 'ready' as ChatStatus,
  error: undefined as Error | undefined,
  onData: undefined as ((part: unknown) => void) | undefined,
  onError: undefined as ((err: Error) => void) | undefined,
  sendMessage: vi.fn(async () => undefined),
  setMessages: vi.fn(),
  stop: vi.fn(),
};

vi.mock('@ai-sdk/react', () => ({
  useChat: (opts: {
    onData?: (part: unknown) => void;
    onError?: (err: Error) => void;
  }) => {
    chat.onData = opts.onData;
    chat.onError = opts.onError;
    return {
      sendMessage: chat.sendMessage,
      status: chat.status,
      stop: chat.stop,
      error: chat.error,
      setMessages: chat.setMessages,
    };
  },
}));

/** 保留真实 newAskRequestId；只钉死 transport 与终态回读口 */
vi.mock('@/api/ask', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/ask')>()),
  createAskTransport: vi.fn(() => ({ kind: 'mock-transport' })),
  getAskFinal: vi.fn(),
}));

import { createAskTransport, getAskFinal } from '@/api/ask';
import { useKnowledgeAsk } from '@/hooks/use-knowledge-ask';
import { ApiHttpError } from '@/lib/http';

/** 手动可控 promise：卡住重拉以断言「重拉中」与「只重拉一次」 */
function deferred<T>() {
  let settle!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    settle = resolve;
  });
  return { promise, settle };
}

/** getAskFinal 的 200 ready=true 分支载荷（requestId 由客户端自铸，此处值不参与断言） */
const readyAnswered: AskFinalResponse = {
  requestId: 'req-reconnect-1',
  ready: true,
  response: makeAnsweredFinal(),
};

describe('useKnowledgeAsk 断线重拉终态', () => {
  beforeEach(() => {
    chat.status = 'ready';
    chat.error = undefined;
    chat.onData = undefined;
    chat.onError = undefined;
    chat.sendMessage.mockReset();
    chat.setMessages.mockReset();
    chat.stop.mockReset();
    vi.mocked(createAskTransport).mockClear();
    vi.mocked(getAskFinal).mockReset();
  });

  it('断线后按 requestId 重拉终态 → answered，且不重发提问', async () => {
    vi.mocked(getAskFinal).mockResolvedValue(readyAnswered);
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      await result.current.ask('本轮问题');
    });
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);

    await act(async () => {
      chat.onError?.(new TypeError('network error'));
    });

    await waitFor(() => expect(result.current.view.type).toBe('answered'));
    // 重拉只读终态：不得再发一次提问
    expect(chat.sendMessage).toHaveBeenCalledTimes(1);
    expect(getAskFinal).toHaveBeenCalledTimes(1);
    expect(getAskFinal).toHaveBeenCalledWith(expect.any(String));
  });

  it('重拉抛 404 → unavailable，不得装成 answered 或系统错误卡', async () => {
    vi.mocked(getAskFinal).mockRejectedValue(
      new ApiHttpError('NOT_FOUND', 'ask trace not found', 404),
    );
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      await result.current.ask('本轮问题');
    });

    await act(async () => {
      chat.onError?.(new TypeError('network error'));
    });

    await waitFor(() => expect(result.current.view.type).toBe('unavailable'));
    const view = result.current.view;
    if (view.type !== 'unavailable') throw new Error(`期望 unavailable，实际 ${view.type}`);
    expect(view.message.trim().length).toBeGreaterThan(0);
    expect(view.requestId.length).toBeGreaterThan(0);
  });

  it('重拉 ready=false → unavailable，message 用服务端文案', async () => {
    const serverMessage = '该轮引用未落库（早于引用落库的历史轮次），暂无法回读终态';
    vi.mocked(getAskFinal).mockResolvedValue({
      requestId: 'req-reconnect-1',
      ready: false,
      message: serverMessage,
    });
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      await result.current.ask('本轮问题');
    });

    await act(async () => {
      chat.onError?.(new TypeError('network error'));
    });

    await waitFor(() => expect(result.current.view.type).toBe('unavailable'));
    expect(result.current.view).toMatchObject({ type: 'unavailable', message: serverMessage });
    expect(result.current.view.type).not.toBe('answered');
  });

  it('连续两次断线只重拉一次终态', async () => {
    const gate = deferred<AskFinalResponse>();
    vi.mocked(getAskFinal).mockReturnValue(gate.promise);
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      await result.current.ask('本轮问题');
    });

    await act(async () => {
      chat.onError?.(new TypeError('network error'));
      chat.onError?.(new TypeError('network error'));
    });
    expect(getAskFinal).toHaveBeenCalledTimes(1);

    await act(async () => {
      gate.settle(readyAnswered);
      await gate.promise;
    });
    await waitFor(() => expect(result.current.view.type).toBe('answered'));
    expect(getAskFinal).toHaveBeenCalledTimes(1);
  });

  it('429 配额不重拉，保留既有 error 卡', async () => {
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      await result.current.ask('本轮问题');
    });

    await act(async () => {
      chat.onError?.(new ApiHttpError('RATE_LIMITED', 'ask rate limit exceeded', 429));
    });

    expect(result.current.view).toEqual({
      type: 'error',
      code: 'RATE_LIMITED',
      message: 'ask rate limit exceeded',
      httpStatus: 429,
    });
    expect(getAskFinal).not.toHaveBeenCalled();
  });

  it('每轮换新请求号：同一轮内同一非空 id，再提问后换新值', async () => {
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    const getRequestId = vi.mocked(createAskTransport).mock.calls[0]?.[0]?.getRequestId;
    expect(typeof getRequestId).toBe('function');
    if (!getRequestId) throw new Error('createAskTransport 未收到 getRequestId');

    const first = getRequestId();
    expect(first.length).toBeGreaterThan(0);
    expect(getRequestId()).toBe(first);

    await act(async () => {
      await result.current.ask('第二轮问题');
    });

    const second = getRequestId();
    expect(second.length).toBeGreaterThan(0);
    expect(second).not.toBe(first);
  });
});
