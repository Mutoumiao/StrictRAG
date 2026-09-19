/**
 * 目标：无 tenantId 的 ES bulk builder 必须失败，且不得发出任何 HTTP。
 * 需求：剧本 O4 · ADR-041（filter 即使独立也强制）
 * 被测：sparseBulkSource / bulkIndexSparse
 * 简介：缺 / 空 tenantId 构 source 即抛；bulkIndexSparse 在抛之前不得 fetch；带 tenantId 时 source 逐位不变。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bulkIndexSparse, sparseBulkSource } from '../../src/ingest/es-http.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const CFG = { baseUrl: 'http://es.local:9200', index: 'strict_rag_dev' };

function bulkDoc(tenantId: unknown) {
  return {
    chunkId: 'c1',
    tenantId,
    kbId: KB,
    docId: 'd1',
    sparseText: '正文',
  } as never;
}

describe('worker ES bulk 的 tenantId 硬约束（剧本 O4）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('缺 / 空 tenantId：构 source 即抛', () => {
    expect(() => sparseBulkSource(bulkDoc(undefined))).toThrow(/missing tenantId/);
    expect(() => sparseBulkSource(bulkDoc(''))).toThrow(/missing tenantId/);
    expect(() => sparseBulkSource(bulkDoc('  '))).toThrow(/missing tenantId/);
  });

  it('缺 tenantId 时 bulkIndexSparse 失败且不发 HTTP', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);

    await expect(bulkIndexSparse(CFG, [bulkDoc(undefined), bulkDoc(TENANT)])).rejects.toThrow(
      /missing tenantId/,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('有 tenantId：source 逐位不变（未放宽既有写入）', () => {
    expect(sparseBulkSource(bulkDoc(TENANT))).toEqual({
      chunkId: 'c1',
      tenantId: TENANT,
      kbId: KB,
      docId: 'd1',
      sparseText: '正文',
    });
  });
});
