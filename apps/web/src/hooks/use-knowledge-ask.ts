'use client';

/**
 * 知识库提问：基于 @ai-sdk/react useChat，订阅 data-status / data-ask-final。
 * data-ask-final 必须 AskResponseSchema 校验通过才进 answered/abstained。
 */

import { useChat } from '@ai-sdk/react';
import {
  AskResponseSchema,
  AskSseStatusSchema,
  type AskResponse,
} from '@strict-rag/contracts';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAskTransport } from '@/api/ask';

export type KnowledgeAskView =
  | { type: 'idle' }
  | { type: 'loading'; phase?: string }
  | { type: 'answered'; data: AskResponse }
  | { type: 'abstained'; data: AskResponse }
  | { type: 'error'; code: string; message: string };

export type UseKnowledgeAskArgs = {
  kbId: string;
  sessionId: string | null;
};

export function useKnowledgeAsk({ kbId, sessionId }: UseKnowledgeAskArgs) {
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  const [view, setView] = useState<KnowledgeAskView>({ type: 'idle' });
  const [lastFinal, setLastFinal] = useState<AskResponse | null>(null);

  const transport = useMemo(() => {
    if (!kbId.trim()) return undefined;
    return createAskTransport({
      kbId: kbId.trim(),
      getSessionId: () => sessionIdRef.current,
    });
  }, [kbId]);

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
      setView({
        type: 'error',
        code: 'INTERNAL',
        message: err.message || '请求失败',
      });
    },
  });

  useEffect(() => {
    if (status === 'submitted' || status === 'streaming') {
      setView((prev) => (prev.type === 'loading' ? prev : { type: 'loading', phase: 'running' }));
    }
  }, [status]);

  useEffect(() => {
    if (error) {
      setView({
        type: 'error',
        code: 'INTERNAL',
        message: error.message || '请求失败',
      });
    }
  }, [error]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim();
      if (!q || !kbId.trim() || !transport) return;
      setLastFinal(null);
      setMessages([]);
      setView({ type: 'loading', phase: 'running' });
      await sendMessage({ text: q });
    },
    [kbId, transport, sendMessage, setMessages],
  );

  const reset = useCallback(() => {
    stop();
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
