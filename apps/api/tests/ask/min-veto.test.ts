/**
 * 目标：claim 级 min 不达标时整答必须拒答，禁止均值洗白后 answered。
 * 需求：P0 R8 · prds/08-quality/01-verification-and-abstention.md
 * 被测：runAskGraph（judge 分数路径）
 * 简介：单条低分 claim 即整答拒答，不看均值。
 */
import { describe, expect, it } from 'vitest';

import { baseInput, CHUNK, deps, runAskGraph, scriptedChat } from './_support/graph-harness.js';

describe('runAskGraph M3 verify+min+budget', () => {
  it('R8: min veto: one low score → unsupported_claims', async () => {
    const r = await runAskGraph(
      baseInput({ tauClaim: 0.5 }),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假15天且可无限延期。',
            citations: [CHUNK],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [
              { text: '年假15天', chunkIds: [CHUNK] },
              { text: '可无限延期', chunkIds: [CHUNK] },
            ],
          }),
          judge: JSON.stringify({ scores: [0.95, 0.1] }),
        }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'unsupported_claims' });
    expect(r.answer).toBe('');
  });
});
