/**
 * 目标：流式 ready 且无合法 final 时不得卡在 loading，必须落到 error。
 * 需求：P0 R1
 * 被测：useKnowledgeAsk
 * 简介：流式三态；非法终态 → error。
 */

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeAbstainedFinal, makeAnsweredFinal } from '@/test/fixtures/ask';

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

vi.mock('@/api/ask', () => ({
  createAskTransport: vi.fn(() => ({ kind: 'mock-transport' })),
}));

import { createAskTransport } from '@/api/ask';
import { useKnowledgeAsk } from '@/hooks/use-knowledge-ask';
import { ApiHttpError } from '@/lib/http';

describe('useKnowledgeAsk', () => {
  beforeEach(() => {
    chat.status = 'ready';
    chat.error = undefined;
    chat.onData = undefined;
    chat.onError = undefined;
    chat.sendMessage.mockReset();
    chat.setMessages.mockReset();
    chat.stop.mockReset();
    vi.mocked(createAskTransport).mockClear();
  });

  it('B11：把 getScope 传给 createAskTransport', () => {
    const getScope = () => ({ docTypes: ['hr'] as string[] });
    renderHook(() =>
      useKnowledgeAsk({ kbId: 'kb-1', sessionId: null, getScope }),
    );
    expect(createAskTransport).toHaveBeenCalled();
    const arg = vi.mocked(createAskTransport).mock.calls[0]?.[0];
    expect(arg?.getScope?.()).toEqual({ docTypes: ['hr'] });
  });

  it('把 getMode 传给 createAskTransport', () => {
    const getMode = () => 'fast' as const;
    renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null, getMode }));
    const arg = vi.mocked(createAskTransport).mock.calls[0]?.[0];
    expect(arg?.getMode?.()).toBe('fast');
  });

  it('合法 final → answered / abstained', async () => {
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      chat.onData?.({ type: 'data-ask-final', data: makeAnsweredFinal() });
    });
    expect(result.current.view.type).toBe('answered');

    await act(async () => {
      chat.onData?.({ type: 'data-ask-final', data: makeAbstainedFinal() });
    });
    expect(result.current.view.type).toBe('abstained');
  });

  it('kb_not_ready final 进 abstained，不被系统错误占住', async () => {
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    const kbNotReady = makeAbstainedFinal({
      reason: 'kb_not_ready',
      userMessage: '知识库尚无可用文档，请稍后再试或联系管理员。',
      suggestedActions: [{ type: 'contact_admin', label: '联系管理员' }],
    });
    await act(async () => {
      chat.onData?.({
        type: 'data-status',
        data: { phase: 'error', code: 'KB_NOT_READY', message: 'empty kb' },
      });
    });
    await act(async () => {
      chat.onData?.({ type: 'data-ask-final', data: kbNotReady });
    });
    expect(result.current.view).toMatchObject({
      type: 'abstained',
      data: { reason: 'kb_not_ready' },
    });
  });

  it('非法 final / status error → error', async () => {
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      chat.onData?.({ type: 'data-ask-final', data: { status: 'answered', answer: 'x' } });
    });
    expect(result.current.view).toMatchObject({ type: 'error', message: '流式终态载荷无效' });

    await act(async () => {
      chat.onData?.({
        type: 'data-status',
        data: { phase: 'error', code: 'BUDGET', message: '超时' },
      });
    });
    expect(result.current.view).toEqual({ type: 'error', code: 'BUDGET', message: '超时' });
  });

  it('onError 保留 RATE_LIMITED 与 HTTP 429', async () => {
    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      chat.onError?.(new ApiHttpError('RATE_LIMITED', 'ask rate limit exceeded', 429));
    });
    expect(result.current.view).toEqual({
      type: 'error',
      code: 'RATE_LIMITED',
      message: 'ask rate limit exceeded',
      httpStatus: 429,
    });
  });

  it('R1: ready 仍 loading → 错误兜底；有 final 后 ready 不覆盖', async () => {
    const { result, rerender } = renderHook(() =>
      useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }),
    );

    chat.status = 'streaming';
    rerender();
    await act(async () => {
      await result.current.ask('q');
    });
    expect(result.current.view.type).toBe('loading');

    chat.status = 'ready';
    rerender();
    await waitFor(() => expect(result.current.view.type).toBe('error'));

    chat.status = 'streaming';
    rerender();
    await act(async () => {
      await result.current.ask('q2');
      chat.onData?.({ type: 'data-ask-final', data: makeAnsweredFinal() });
    });
    chat.status = 'ready';
    rerender();
    await waitFor(() => expect(result.current.view.type).toBe('answered'));
  });

  it('空 kb 不发送；reset 回 idle', async () => {
    const empty = renderHook(() => useKnowledgeAsk({ kbId: '  ', sessionId: null }));
    await act(async () => {
      await empty.result.current.ask('hello');
    });
    expect(chat.sendMessage).not.toHaveBeenCalled();

    const { result } = renderHook(() => useKnowledgeAsk({ kbId: 'kb-1', sessionId: null }));
    await act(async () => {
      chat.onData?.({ type: 'data-ask-final', data: makeAnsweredFinal() });
    });
    act(() => result.current.reset());
    expect(chat.stop).toHaveBeenCalled();
    expect(result.current.view.type).toBe('idle');
  });
});
