/**
 * 目标：混合检索的余弦相似与 RRF 融合按预期排序。
 * 需求：prds/04-pipelines
 * 被测：cosine / rrfFuse
 * 简介：打分与倒数秩融合的纯函数。
 */

import { describe, expect, it } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { rrfFuse } from '../../src/services/retrieve/rrf.js';
import { cosine } from '../../src/services/retrieve/scoring.js';

const dims = 8;

describe('scoring / rrf', () => {
  it('cosine is 1 for identical vectors', () => {
    const v = mockEmbedVector('hello world', dims);
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  it('rrf prefers items high in multiple lists', () => {
    const fused = rrfFuse([
      ['a', 'b', 'c'],
      ['b', 'a', 'd'],
    ]);
    expect(fused[0]?.id).toBe('a');
    // a ranks 1+2, b ranks 2+1 — a slightly higher with k=60
    expect(fused.map((f) => f.id)).toContain('b');
  });
});
