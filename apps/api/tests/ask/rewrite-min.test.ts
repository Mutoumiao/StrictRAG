/**
 * 目标：rewrite 最小开路径：弱指代独立问句、未解析则不检索、回指四态派生正确。
 * 需求：prds/04-pipelines P2.5 rewrite min
 * 被测：runAskGraph（rewrite 开）
 * 简介：开 rewrite 时检索用独立问句；未解析不检索；session/document/external 回指四态。
 */
import { describe, expect, it } from 'vitest';

import {
  baseInput,
  deps,
  DOC,
  evidenceOk,
  happyChat,
  HIST_A,
  rewriteHappyChat,
  runAskGraph,
  scriptedChat,
  SID,
  SID_B,
  STANDALONE,
} from './_support/graph-harness.js';

describe('runAskGraph P2.5 rewrite min', () => {
  it('on + window + weak coref: retrieve gets standalone; rewriteUsed=true', async () => {
    let retrieveQ = '';
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: '差旅住宿标准是什么？' },
          { role: 'assistant', content: '住宿上限 500 元。' },
        ],
        retrieve: async ({ question }) => {
          retrieveQ = question;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: rewriteHappyChat,
      }),
    );
    expect(retrieveQ).toBe(STANDALONE);
    expect(retrieveQ).not.toBe('那餐补呢？');
    expect(r.rewriteUsed).toBe(true);
    expect(r.standaloneQuestion).toBe(STANDALONE);
    expect(r.debug?.llmCalls).toBe(4);
    expect(r.reason).toBe('verified');
  });

  it('on + resolved=false → coref_unresolved; retrieve 0 times', async () => {
    let retrieveCount = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那个呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        retrieve: async () => {
          retrieveCount += 1;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: scriptedChat({
          rewrite: JSON.stringify({ standalone: '无法消解', resolved: false }),
        }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'coref_unresolved' });
    expect(retrieveCount).toBe(0);
    expect(r.rewriteUsed).toBe(false);
  });

  it('on + illegal JSON → coref_unresolved; retrieve 0 times', async () => {
    let retrieveCount = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那个呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        retrieve: async () => {
          retrieveCount += 1;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: scriptedChat({ rewrite: 'not-json-at-all' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'coref_unresolved' });
    expect(retrieveCount).toBe(0);
  });

  it('J2x: loader only called with current sessionId; retrieve must not contain A window', async () => {
    const seen: string[] = [];
    let retrieveQ = '';
    const r = await runAskGraph(
      baseInput({ sessionId: SID_B, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async ({ sessionId }) => {
          seen.push(sessionId);
          expect(sessionId).toBe(SID_B);
          return [{ role: 'user', content: 'B会话差旅标准' }];
        },
        retrieve: async ({ question }) => {
          retrieveQ = question;
          expect(question).not.toContain(HIST_A);
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: rewriteHappyChat,
      }),
    );
    expect(seen).toEqual([SID_B]);
    expect(retrieveQ).not.toContain(HIST_A);
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(HIST_A);
    expect(r.rewriteUsed).toBe(true);
  });

  it('should rewrite but budget 0 → budget_exhausted', async () => {
    let retrieveCount = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        retrieve: async () => {
          retrieveCount += 1;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: rewriteHappyChat,
        budgetOverride: { maxLLMCalls: 0, maxRetrieveCalls: 6 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
    expect(retrieveCount).toBe(0);
  });

  it('on + explicit backref + long window → sessionDeepened=true', async () => {
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '根据刚才说的住宿标准，餐补怎么算？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: 'u1 年假天数' },
          { role: 'assistant', content: 'a1 15天' },
          { role: 'user', content: 'u2 差旅住宿' },
          { role: 'assistant', content: 'a2 上限500' },
          { role: 'user', content: 'u3 机票怎么报' },
          { role: 'assistant', content: 'a3 经济舱' },
          { role: 'user', content: 'u4 住宿标准是什么？' },
          { role: 'assistant', content: 'a4 上限500元。' },
        ],
        chat: rewriteHappyChat,
      }),
    );
    expect(r.sessionDeepened).toBe(true);
    expect(r.rewriteUsed).toBe(true);
    expect(r.backReference).toBe('session');
  });

  it('on + weak coref 那餐补呢 → sessionDeepened=false', async () => {
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: '差旅住宿标准是什么？' },
          { role: 'assistant', content: '住宿上限 500 元。' },
        ],
        chat: rewriteHappyChat,
      }),
    );
    expect(r.sessionDeepened).toBe(false);
  });

  it('document-only backref: sessionDeepened=false; retrieve gets preferred', async () => {
    const HIST = 'DOC_ONLY_SECRET_HIST';
    let seenPreferred: readonly string[] | undefined;
    const purposes: string[] = [];
    const r = await runAskGraph(
      baseInput({
        sessionId: SID,
        question: '这份文档的适用范围是什么',
        preferredDocIds: [DOC],
      }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: HIST },
          { role: 'assistant', content: '根据聊天年假999天' },
        ],
        retrieve: async ({ preferredDocIds }) => {
          seenPreferred = preferredDocIds;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: {
              esMode: 'mock',
              candidateCount: 1,
              denseHits: 1,
              sparseHits: 1,
              preferredAdopted: true,
            },
          };
        },
        chat: async (purpose, messages) => {
          purposes.push(purpose);
          return rewriteHappyChat(purpose, messages);
        },
      }),
    );
    expect(r.sessionDeepened).toBe(false);
    expect(r.documentBackref).toBe(true);
    expect(r.backReference).toBe('document');
    expect(seenPreferred).toEqual([DOC]);
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(HIST);
    expect(JSON.stringify(r.citations)).not.toContain(HIST);
    expect(purposes).toContain('judge');
    expect(r.reason).toBe('verified');
  });

  it('both session+document: deepen and pass preferred; history ≠ evidence', async () => {
    const HIST = 'BOTH_SECRET_WINDOW';
    let seenPreferred: readonly string[] | undefined;
    const r = await runAskGraph(
      baseInput({
        sessionId: SID,
        question: '根据刚才说的，那份文档还有补充吗',
        preferredDocIds: [DOC],
      }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: HIST },
          { role: 'assistant', content: '窗内原文不得进证据' },
        ],
        retrieve: async ({ preferredDocIds }) => {
          seenPreferred = preferredDocIds;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: {
              esMode: 'mock',
              candidateCount: 1,
              denseHits: 1,
              sparseHits: 1,
              preferredAdopted: true,
            },
          };
        },
        chat: rewriteHappyChat,
      }),
    );
    expect(r.sessionDeepened).toBe(true);
    expect(r.documentBackref).toBe(true);
    expect(r.backReference).toBe('session');
    expect(seenPreferred).toEqual([DOC]);
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(HIST);
    expect(r.reason).toBe('verified');
  });

  it('external backref discards preferred; documentBackref=false', async () => {
    const HIST = 'EXT_SECRET_WINDOW';
    let seenPreferred: readonly string[] | undefined;
    const purposes: string[] = [];
    const r = await runAskGraph(
      baseInput({
        sessionId: SID,
        question: '网上那份文件怎么说',
        preferredDocIds: [DOC],
      }),
      deps({
        rewriteEnabled: false,
        retrieve: async ({ preferredDocIds }) => {
          seenPreferred = preferredDocIds;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: {
              esMode: 'mock',
              candidateCount: 1,
              denseHits: 1,
              sparseHits: 1,
              preferredAdopted: true,
            },
          };
        },
        chat: async (purpose, messages) => {
          purposes.push(purpose);
          return happyChat(purpose, messages);
        },
      }),
    );
    expect(r.externalBackref).toBe(true);
    expect(r.documentBackref).toBe(false);
    expect(r.sessionDeepened).toBe(false);
    expect(r.backReference).toBe('external');
    expect(seenPreferred).toBeUndefined();
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(HIST);
    expect(JSON.stringify(r.citations)).not.toContain(HIST);
    expect(purposes).toContain('judge');
    expect(r.reason).toBe('verified');
  });

  it('external does not set sessionDeepened; session+external still deepens', async () => {
    const HIST = 'EXT_SESSION_SECRET';
    let seenPreferred: readonly string[] | undefined;
    const r = await runAskGraph(
      baseInput({
        sessionId: SID,
        question: '根据刚才说的网上那份文件',
        preferredDocIds: [DOC],
      }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: HIST },
          { role: 'assistant', content: '窗内原文不得进证据' },
        ],
        retrieve: async ({ preferredDocIds }) => {
          seenPreferred = preferredDocIds;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: {
              esMode: 'mock',
              candidateCount: 1,
              denseHits: 1,
              sparseHits: 1,
              preferredAdopted: true,
            },
          };
        },
        chat: rewriteHappyChat,
      }),
    );
    expect(r.externalBackref).toBe(true);
    expect(r.documentBackref).toBe(false);
    expect(r.sessionDeepened).toBe(true);
    expect(r.backReference).toBe('external');
    expect(seenPreferred).toBeUndefined();
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(HIST);
    expect(JSON.stringify(r.citations)).not.toContain(HIST);
    expect(r.reason).toBe('verified');
  });

  it('document backref but preferred not adopted → documentBackref=false', async () => {
    const r = await runAskGraph(
      baseInput({
        sessionId: SID,
        question: '这份文档的适用范围是什么',
        preferredDocIds: ['ghost-doc'],
      }),
      deps({
        rewriteEnabled: false,
        retrieve: async ({ preferredDocIds }) => {
          expect(preferredDocIds).toEqual(['ghost-doc']);
          return {
            ok: true,
            evidence: evidenceOk,
            meta: {
              esMode: 'mock',
              candidateCount: 1,
              denseHits: 1,
              sparseHits: 1,
              preferredAdopted: false,
            },
          };
        },
        chat: happyChat,
      }),
    );
    expect(r.sessionDeepened).toBe(false);
    expect(r.documentBackref).toBe(false);
    expect(r.backReference).toBe('document');
  });
});
