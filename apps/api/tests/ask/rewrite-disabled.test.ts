/**
 * 目标：rewrite 关闭或无 loader 时不得改写问句、不得 500。
 * 需求：SESSION_REWRITE_ENABLED 默认关
 * 被测：runAskGraph（rewrite 关）
 * 简介：关开关、无会话、fast、无 loader 时不调用 rewrite，也不 500。
 */
import { describe, expect, it } from 'vitest';

import {
  type AskGraphInput,
  baseInput,
  deps,
  evidenceOk,
  happyChat,
  runAskGraph,
  SID,
} from './_support/graph-harness.js';

describe('runAskGraph P2.5 rewrite min', () => {
  it('off + session: no rewrite purpose; retrieve uses raw; loader not called', async () => {
    const purposes: string[] = [];
    let retrieveQ = '';
    let loaderCalls = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: false,
        loadSessionWindow: async () => {
          loaderCalls += 1;
          return [{ role: 'user', content: '差旅住宿标准' }];
        },
        retrieve: async ({ question }) => {
          retrieveQ = question;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: async (purpose, messages) => {
          purposes.push(purpose);
          return happyChat(purpose, messages);
        },
      }),
    );
    expect(purposes).not.toContain('rewrite');
    expect(loaderCalls).toBe(0);
    expect(retrieveQ).toBe('那餐补呢？');
    expect(r.rewriteUsed).toBe(false);
    expect(r.reason).toBe('verified');
  });

  it('no session / empty window / fast: no rewrite', async () => {
    const cases: Array<{
      name: string;
      over: Partial<AskGraphInput>;
      window?: { role: 'user' | 'assistant'; content: string }[];
    }> = [
      { name: 'no session', over: { sessionId: null, question: '那餐补呢？' } },
      { name: 'empty window', over: { sessionId: SID, question: '那餐补呢？' }, window: [] },
      { name: 'fast', over: { sessionId: SID, mode: 'fast', question: '那餐补呢？' } },
    ];

    for (const c of cases) {
      const purposes: string[] = [];
      let loaderCalls = 0;
      const r = await runAskGraph(
        baseInput(c.over),
        deps({
          rewriteEnabled: true,
          loadSessionWindow: async () => {
            loaderCalls += 1;
            return c.window ?? [{ role: 'user', content: '差旅' }];
          },
          chat: async (purpose, messages) => {
            purposes.push(purpose);
            return happyChat(purpose, messages);
          },
        }),
      );
      expect(purposes, c.name).not.toContain('rewrite');
      expect(r.rewriteUsed, c.name).toBe(false);
      expect(r.sessionDeepened, c.name).toBe(false);
      if (c.name === 'no session' || c.name === 'fast') {
        expect(loaderCalls, c.name).toBe(0);
      }
      if (c.name === 'empty window') {
        expect(loaderCalls).toBe(1);
      }
    }
  });

  it('off rewrite + explicit backref → sessionDeepened=false', async () => {
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '根据刚才说的住宿标准，餐补怎么算？' }),
      deps({
        rewriteEnabled: false,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        chat: happyChat,
      }),
    );
    expect(r.sessionDeepened).toBe(false);
    expect(r.rewriteUsed).toBe(false);
  });

  it('enabled but no loader: skip rewrite, no 500', async () => {
    const purposes: string[] = [];
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '年假有多少天？' }),
      deps({
        rewriteEnabled: true,
        chat: async (purpose, messages) => {
          purposes.push(purpose);
          return happyChat(purpose, messages);
        },
      }),
    );
    expect(purposes).not.toContain('rewrite');
    expect(r.rewriteUsed).toBe(false);
    expect(r.reason).toBe('verified');
  });
});
