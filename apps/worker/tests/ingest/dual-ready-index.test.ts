/**
 * 目标：未 ready∧active 不得进 mock ES 索引。
 * 需求：质量红线双就绪（入库期；R7 主锚仍在 api corpus）
 * 被测：mockEsStore 双就绪
 * 简介：mock ES 对账缺块失败；集合一致才 ok；文档间不污染。
 */
import { describe, expect, it } from 'vitest';

import { mockEsStore } from '../../src/ingest/es-store.js';

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
