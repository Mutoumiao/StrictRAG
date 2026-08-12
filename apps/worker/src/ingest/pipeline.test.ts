import { describe, expect, it } from 'vitest';

import { isScanModeRuntimeBlocked } from '../scan-mode-policy.js';
import { mockEsStore } from './es-store.js';
import { splitByChunkStrategy, splitParagraphs } from './pipeline.js';

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

describe('mock ES dual-ready gate', () => {
  it('reconcile fails when ES empty', () => {
    mockEsStore.reset();
    const r = mockEsStore.reconcile('doc1', 1, ['c1', 'c2']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['c1', 'c2']);
  });

  it('reconcile ok when sets match', () => {
    mockEsStore.reset();
    mockEsStore.bulkIndex('doc1', 1, ['c2', 'c1']);
    const r = mockEsStore.reconcile('doc1', 1, ['c1', 'c2']);
    expect(r.ok).toBe(true);
  });

  it('multi-doc same indexVersion do not pollute each other', () => {
    mockEsStore.reset();
    mockEsStore.bulkIndex('doc-a', 1, ['a1', 'a2']);
    mockEsStore.bulkIndex('doc-b', 1, ['b1']);
    expect(mockEsStore.reconcile('doc-a', 1, ['a1', 'a2']).ok).toBe(true);
    expect(mockEsStore.reconcile('doc-b', 1, ['b1']).ok).toBe(true);
    // 另一文档的 chunk 不得出现在本 doc 对账 orphan 中
    expect(mockEsStore.reconcile('doc-a', 1, ['a1', 'a2']).orphan).toEqual([]);
  });
});

describe('scan mode runtime · X-02', () => {
  it('on 在运行时被拦截（不得 clean）', () => {
    expect(isScanModeRuntimeBlocked('on')).toBe(true);
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
