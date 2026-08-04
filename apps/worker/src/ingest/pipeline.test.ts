import { describe, expect, it } from 'vitest';

import { mockEsStore } from './es-store.js';
import { splitParagraphs } from './pipeline.js';

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

describe('mock ES dual-ready gate', () => {
  it('reconcile fails when ES empty', () => {
    mockEsStore.reset();
    const r = mockEsStore.reconcile('kb1', 1, ['c1', 'c2']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['c1', 'c2']);
  });

  it('reconcile ok when sets match', () => {
    mockEsStore.reset();
    mockEsStore.bulkIndex('kb1', 1, ['c2', 'c1']);
    const r = mockEsStore.reconcile('kb1', 1, ['c1', 'c2']);
    expect(r.ok).toBe(true);
  });
});

describe('serial embed→es readiness', () => {
  function canMarkReady(embedReady: number, esReady: number): boolean {
    return embedReady === 1 && esReady === 1;
  }

  it('forbids half-ready', () => {
    expect(canMarkReady(1, 0)).toBe(false);
    expect(canMarkReady(0, 1)).toBe(false);
    expect(canMarkReady(0, 0)).toBe(false);
    expect(canMarkReady(1, 1)).toBe(true);
  });
});
