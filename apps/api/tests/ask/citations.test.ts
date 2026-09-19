/**
 * 目标：非法 citation 不得 answered；混合法/非法只保留证据 id 并仍走 verify。
 * 需求：prds/08-quality
 * 被测：runAskGraph（generate+citations）
 * 简介：非法引用拒答；混合引用只留证据 id；重复引用按 chunkId 去重保序；insufficient 走 model_abstained。
 */
import { describe, expect, it } from 'vitest';

import { baseInput, CHUNK, deps, evidenceOk, runAskGraph, scriptedChat } from './_support/graph-harness.js';

describe('runAskGraph M2 generate+citations', () => {
  it('illegal citations → invalid_citations (not answered)', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '瞎编答案',
            citations: ['99999999-9999-7999-8999-999999999999'],
            insufficient: false,
          }),
        }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'invalid_citations' });
  });

  it('mixed legal+illegal citations keeps only evidence ids and still verifies', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK, '99999999-9999-7999-8999-999999999999'],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
          }),
          judge: JSON.stringify({ scores: [0.9] }),
        }),
      }),
    );
    expect(r.status).toBe('answered');
    expect(r.reason).toBe('verified');
    expect(r.citations.map((c) => c.chunkId)).toEqual([CHUNK]);
  });

  it('重复引用同一证据 → 只出一条（去重保序）', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK, CHUNK, CHUNK],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
          }),
          judge: JSON.stringify({ scores: [0.9] }),
        }),
      }),
    );
    expect(r.status).toBe('answered');
    expect(r.citations.map((c) => c.chunkId)).toEqual([CHUNK]);
  });

  it('两块交错重复 → 保留首次出现顺序，不重排', async () => {
    const CHUNK_B = '55555555-5555-7555-8555-555555555555';
    const r = await runAskGraph(
      baseInput(),
      deps({
        retrieve: async () => ({
          ok: true,
          evidence: [...evidenceOk, { ...evidenceOk[0]!, chunkId: CHUNK_B }],
          meta: { esMode: 'mock', candidateCount: 2, denseHits: 2, sparseHits: 2 },
        }),
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK_B, CHUNK, CHUNK_B],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
          }),
          judge: JSON.stringify({ scores: [0.9] }),
        }),
      }),
    );
    expect(r.status).toBe('answered');
    expect(r.citations.map((c) => c.chunkId)).toEqual([CHUNK_B, CHUNK]);
  });

  it('insufficient flag → model_abstained', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({ answer: '', citations: [], insufficient: true }),
        }),
      }),
    );
    expect(r.reason).toBe('model_abstained');
  });
});

describe('剧本 X7 · citation 必须落在 scope 语料内（不得只滤前端）', () => {
  it('generate 引用场外 chunk → 该引用被丢弃，citation 与 evidence 都不含它', async () => {
    const OUT_OF_SCOPE = '77777777-7777-7777-8777-777777777777';
    const r = await runAskGraph(
      baseInput({ question: '年假有多少天？', scope: { docTypes: ['hr'] } }),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK, OUT_OF_SCOPE],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
          }),
          judge: JSON.stringify({ scores: [0.9] }),
        }),
      }),
    );

    expect(r.status).toBe('answered');
    expect(r.citations.map((c) => c.chunkId)).toEqual([CHUNK]);
    expect(r.evidence_snapshot.every((e) => e.chunkId === CHUNK)).toBe(true);
    expect(r.citations.map((c) => c.chunkId)).not.toContain(OUT_OF_SCOPE);
    expect(r.answer).not.toContain(OUT_OF_SCOPE);
  });
});
