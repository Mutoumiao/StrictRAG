'use client';

/**
 * 知识库提问：基于 @ai-sdk/react useChat，订阅 data-status / data-ask-final。
 * data-ask-final 必须 AskResponseSchema 校验通过才进 answered/abstained。
 */

import { useChat } from '@ai-sdk/react';
import {
  AskResponseSchema,
  AskSseStatusSchema,
  type AskMode,
  type AskRequest,
  type AskResponse,
} from '@strict-rag/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAskTransport, getAskFinal, newAskRequestId } from '@/api/ask';
import { ApiHttpError } from '@/lib/http';

export type KnowledgeAskView =
  | { type: 'idle' }
  | { type: 'loading'; phase?: string }
  /** 断线：正按 requestId 取回该轮终态（**不重发提问**） */
  | { type: 'recovering'; requestId: string }
  | { type: 'answered'; data: AskResponse }
  | { type: 'abstained'; data: AskResponse }
  /** 终态读不回（未落库 / 未就绪）；**不得**当成 answered 或审计快照 */
  | { type: 'unavailable'; requestId: string; message: string }
  | { type: 'error'; code: string; message: string; httpStatus?: number };

export type UseKnowledgeAskArgs = {
  kbId: string;
  sessionId: string | null;
  /** B11：每次发送时读 scope（ref 挂载，改类型不重建 transport） */
  getScope?: () => AskRequest['scope'];
  /** 每次发送时读档位；缺省不传 mode（服务端 defaultMode） */
  getMode?: () => AskMode | undefined;
};

function errorViewFromUnknown(err: unknown): Extract<KnowledgeAskView, { type: 'error' }> {
  if (err instanceof ApiHttpError) {
    return {
      type: 'error',
      code: err.code,
      message: err.message || '请求失败',
      httpStatus: err.httpStatus,
    };
  }
  const message = err instanceof Error ? err.message : '请求失败';
  return { type: 'error', code: 'INTERNAL', message: message || '请求失败' };
}

/**
 * 4xx 业务拒（鉴权 / 配额 / 校验）说明这一轮根本没跑起来，重拉不会有终态，
 * 且重拉会把 429 之类的关键文案冲掉；只有 5xx 与网络中断才值得回读。
 */
function worthReconnect(err: unknown): boolean {
  if (err instanceof ApiHttpError) {
    return err.httpStatus == null || err.httpStatus >= 500;
  }
  return true;
}

export function useKnowledgeAsk({ kbId, sessionId, getScope, getMode }: UseKnowledgeAskArgs) {
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
  const getScopeRef = useRef(getScope);
  getScopeRef.current = getScope;
  const getModeRef = useRef(getMode);
  getModeRef.current = getMode;

  const [view, setView] = useState<KnowledgeAskView>({ type: 'idle' });
  const [lastFinal, setLastFinal] = useState<AskResponse | null>(null);
  /** 本轮请求号：客户端自铸并随 `x-request-id` 下发，断线后据此重拉终态 */
  const requestIdRef = useRef<string | null>(null);
  /** 只重拉一次（不做轮询风暴） */
  const recoveredRef = useRef(false);

  const transport = useMemo(() => {
    if (!kbId.trim()) return undefined;
    return createAskTransport({
      kbId: kbId.trim(),
      getSessionId: () => sessionIdRef.current,
      getScope: () => getScopeRef.current?.(),
      getMode: () => getModeRef.current?.(),
      getRequestId: () => (requestIdRef.current ??= newAskRequestId()),
    });
  }, [kbId]);

  /**
   * 断线后按 requestId 取回该轮**终态**：不重发提问、不把审计快照当答案。
   * 取不回时进 `unavailable`（明说读不回），不得编造 answered。
   */
  const recoverFinal = useCallback(async (): Promise<boolean> => {
    const requestId = requestIdRef.current;
    if (!requestId || recoveredRef.current) return false;
    recoveredRef.current = true;
    setView({ type: 'recovering', requestId });
    try {
      const final = await getAskFinal(requestId);
      // 用户已开新一轮：丢弃本次结果，不得覆盖
      if (requestIdRef.current !== requestId) return true;
      if (!final.ready) {
        setView({ type: 'unavailable', requestId, message: final.message });
        return true;
      }
      setLastFinal(final.response);
      setView(
        final.response.status === 'answered'
          ? { type: 'answered', data: final.response }
          : { type: 'abstained', data: final.response },
      );
      return true;
    } catch (err) {
      if (requestIdRef.current !== requestId) return true;
      if (err instanceof ApiHttpError && err.httpStatus === 404) {
        setView({
          type: 'unavailable',
          requestId,
          message: '服务端还没有这一轮的终态记录（可能仍在处理中），请稍后再提问一次。',
        });
        return true;
      }
      setView(errorViewFromUnknown(err));
      return true;
    }
  }, []);

  const { sendMessage, status, stop, error, setMessages } = useChat({
    id: `ask-${kbId || 'none'}`,
    transport,
    onData: (part) => {
      const p = part as { type: string; data?: unknown };
      if (p.type === 'data-status') {
        const s = AskSseStatusSchema.safeParse(p.data);
        if (!s.success) return;
        if (s.data.phase === 'error') {
          setView({
            type: 'error',
            code: s.data.code ?? 'INTERNAL',
            message: s.data.message ?? 'ask failed',
          });
          return;
        }
        setView({ type: 'loading', phase: s.data.phase });
        return;
      }
      if (p.type === 'data-ask-final') {
        const parsed = AskResponseSchema.safeParse(p.data);
        if (!parsed.success) {
          setView({
            type: 'error',
            code: 'INTERNAL',
            message: '流式终态载荷无效',
          });
          return;
        }
        const data = parsed.data;
        setLastFinal(data);
        if (data.status === 'answered') {
          setView({ type: 'answered', data });
        } else {
          setView({ type: 'abstained', data });
        }
      }
    },
    onError: (err) => {
      setView(errorViewFromUnknown(err));
      // 真断线（网络中断 / 5xx）：只重拉一次终态；4xx 业务拒不动
      if (worthReconnect(err)) void recoverFinal();
    },
  });

  useEffect(() => {
    if (status === 'submitted' || status === 'streaming') {
      setView((prev) => (prev.type === 'loading' ? prev : { type: 'loading', phase: 'running' }));
    }
  }, [status]);

  // ponytail: ready 且仍 loading = 无 final，避免提问按钮永 disabled
  useEffect(() => {
    if (status !== 'ready') return;
    setView((prev) => {
      if (prev.type !== 'loading') return prev;
      return {
        type: 'error',
        code: 'INTERNAL',
        message: '流式响应未包含有效终态',
      };
    });
  }, [status]);

  useEffect(() => {
    if (error) {
      setView((prev) => (prev.type === 'recovering' ? prev : errorViewFromUnknown(error)));
    }
  }, [error]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || !kbId.trim() || !transport) return;
      // 每轮换新请求号：同 id 两轮会撞 trace，重拉会取到上一轮
      requestIdRef.current = newAskRequestId();
      recoveredRef.current = false;
      setLastFinal(null);
      setMessages([]);
      setView({ type: 'loading', phase: 'running' });
      await sendMessage({ text: q });
    },
    [kbId, transport, sendMessage, setMessages],
  );

  const reset = useCallback(() => {
    stop();
    requestIdRef.current = null;
    recoveredRef.current = false;
    setMessages([]);
    setLastFinal(null);
    setView({ type: 'idle' });
  }, [stop, setMessages]);

  return {
    view,
    setView,
    lastFinal,
    ask,
    reset,
    stop,
    busy: status === 'submitted' || status === 'streaming',
  };
}
