/**
 * 目标：无 tenantId 的 ES bulk builder 与 ES 查询 builder 必须失败，且不得发出任何 HTTP。
 * 需求：剧本 O4 · ADR-041（filter 即使独立也强制）· 覆盖 O4（全仓口径）
 * 被测：sparseBulkSource / bulkIndexSparse / listIndexedChunkIds
 * 简介：缺 / 空 tenantId 构 source 即抛；bulkIndexSparse 在抛之前不得 fetch；带 tenantId 时 source 逐位不变；
 *       listIndexedChunkIds 缺 / 空 / 纯空白 tenantId 同样即抛，正常路径的 _search 过滤体同带 tenantId 与 docId。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bulkIndexSparse,
  listIndexedChunkIds,
  sparseBulkSource,
} from '../../src/ingest/es-http.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DOC = '01900000-0000-7000-8000-0000000000bb';
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

/** 回读已索引 chunkId 的假响应（只喂 `hits.hits[]._source.chunkId`）。 */
function hitsResponse(ids: string[]): { ok: true; json: () => Promise<unknown> } {
  return {
    ok: true,
    json: async () => ({ hits: { hits: ids.map((id) => ({ _source: { chunkId: id } })) } }),
  };
}

describe('worker ES 查询的 tenantId 硬约束（孤儿清理对账入口）', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('缺 / 空 / 纯空白 tenantId：查索引即抛，且不发 HTTP', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);

    await expect(listIndexedChunkIds(CFG, DOC, undefined)).rejects.toThrow(
      /missing tenantId in listIndexedChunkIds/,
    );
    await expect(listIndexedChunkIds(CFG, DOC, '')).rejects.toThrow(
      /missing tenantId in listIndexedChunkIds/,
    );
    await expect(listIndexedChunkIds(CFG, DOC, '   ')).rejects.toThrow(
      /missing tenantId in listIndexedChunkIds/,
    );

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('带 tenantId：_search 过滤体同带 tenantId 与 docId，命中可回读', async () => {
    const calls: Array<{ url: string; body: unknown }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, body: JSON.parse(String(init?.body ?? '{}')) });
        return hitsResponse(['c1', 'c2']);
      }),
    );

    await expect(listIndexedChunkIds(CFG, DOC, TENANT)).resolves.toEqual(['c1', 'c2']);

    expect(calls[0]?.url).toBe('http://es.local:9200/strict_rag_dev/_search');
    expect(calls[0]?.body).toEqual({
      size: 10_000,
      query: { bool: { filter: [{ term: { tenantId: TENANT } }, { term: { docId: DOC } }] } },
      _source: ['chunkId'],
    });
  });

  it('首尾空白 tenantId：trim 后入过滤体，不补默认租户', async () => {
    let body: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body ?? '{}'));
        return hitsResponse([]);
      }),
    );

    await expect(listIndexedChunkIds(CFG, DOC, `  ${TENANT}  `)).resolves.toEqual([]);
    expect((body as { query: unknown }).query).toEqual({
      bool: { filter: [{ term: { tenantId: TENANT } }, { term: { docId: DOC } }] },
    });
  });
});
