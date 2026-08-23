/**
 * 目标：非法 citation 不得 answered；混合法/非法只保留证据 id 并仍走 verify。
 * 需求：prds/08-quality
 * 被测：runAskGraph（generate+citations）
 * 简介：非法引用拒答；混合引用只留证据 id；insufficient 走 model_abstained。
 */
import { describe, expect, it } from 'vitest';

import { baseInput, CHUNK, deps, runAskGraph, scriptedChat } from './_support/graph-harness.js';

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
