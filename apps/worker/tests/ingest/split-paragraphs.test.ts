/**
 * 目标：段落切分过滤过短文本。
 * 需求：prds/04-pipelines/01-offline-ingest.md
 * 被测：splitParagraphs
 * 简介：按空行切段并丢掉过短片段。
 */
import { describe, expect, it } from 'vitest';

import { splitParagraphs } from '../../src/ingest/pipeline.js';

describe('splitParagraphs', () => {
  it('splits and filters short', () => {
    const text = '第一段内容足够长用于通过最小字数阈值。\n\n短\n\n第二段也足够长用于形成独立 chunk 条目。';
    const parts = splitParagraphs(text, 10);
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for shell text', () => {
    expect(splitParagraphs('   \n\n  ', 40)).toEqual([]);
  });
});
