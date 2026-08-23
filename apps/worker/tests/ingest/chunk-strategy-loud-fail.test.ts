/**
 * 目标：已实现策略可切；未实现不得静默改走段落切。
 * 需求：X-03 · B12
 * 被测：splitByChunkStrategy
 * 简介：structure_paragraph 可切；fixed_window 报 UNSUPPORTED_CHUNK_STRATEGY。
 */
import { describe, expect, it } from 'vitest';

import { splitByChunkStrategy } from '../../src/ingest/pipeline.js';

describe('splitByChunkStrategy · X-03', () => {
  const text = '第一段内容足够长用于通过最小字数阈值。\n\n第二段也足够长用于形成独立 chunk 条目。';

  it('structure_paragraph 可切', () => {
    const r = splitByChunkStrategy('structure_paragraph', text, 10);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.pieces.length).toBeGreaterThanOrEqual(2);
  });

  it('未实现策略 loud fail 不静默段落切', () => {
    const r = splitByChunkStrategy('fixed_window', text, 10);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errorCode).toBe('UNSUPPORTED_CHUNK_STRATEGY');
      expect(r.message).toMatch(/not implemented/i);
    }
  });
});
