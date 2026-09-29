/**
 * 目标：真 ES 上 bulk 写入后紧接的对账查询不得因「近实时刷新未到」而误判缺失。
 * 需求：prds/03-data（ES 稀疏索引）· 剧本 E1（ready+active 可查；对账不得误红）
 * 被测：bulkIndexSparse · listIndexedChunkIds · reconcileIndexed
 * 简介：bulk 请求必须带 refresh=wait_for（否则 _search 读不到刚写入的文档 → missing 误报 →
 *       文档被标 ES_RECONCILE_FAILED，只能靠 BullMQ 重试才转绿）；写后读链路一次性判 ok。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { bulkIndexSparse, listIndexedChunkIds, reconcileIndexed } from '../../src/ingest/es-http.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const DOC = '01900000-0000-7000-8000-0000000000bb';
const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK_A = '01900000-0000-7000-8000-0000000000c1';
const CHUNK_B = '01900000-0000-7000-8000-0000000000c2';
const CFG = { baseUrl: 'http://es.local:9200', index: 'strict_rag_dev' };

function bulkDoc(chunkId: string) {
  return { chunkId, tenantId: TENANT, kbId: KB, docId: DOC, sparseText: '正文' };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ES bulk 与对账的刷新语义', () => {
  it('bulk 必须带 refresh=wait_for，否则写后读会误判缺失', async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        urls.push(String(url));
        return new Response(JSON.stringify({ errors: false, items: [] }), { status: 200 });
      }),
    );

    await bulkIndexSparse(CFG, [bulkDoc(CHUNK_A), bulkDoc(CHUNK_B)]);

    expect(urls).toHaveLength(1);
    const bulkUrl = new URL(urls[0]!);
    expect(bulkUrl.pathname).toBe('/_bulk');
    expect(bulkUrl.searchParams.get('refresh')).toBe('wait_for');
  });

  it('bulk（等待刷新）→ 对账查询 → 一次判 ok，不依赖重试', async () => {
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        const href = String(url);
        seen.push(href);
        if (href.includes('/_bulk')) {
          return new Response(JSON.stringify({ errors: false, items: [] }), { status: 200 });
        }
        // 刷新已生效：写入的两个 chunk 都能被读到
        return new Response(
          JSON.stringify({
            hits: { hits: [{ _source: { chunkId: CHUNK_A } }, { _source: { chunkId: CHUNK_B } }] },
          }),
          { status: 200 },
        );
      }),
    );

    await bulkIndexSparse(CFG, [bulkDoc(CHUNK_A), bulkDoc(CHUNK_B)]);
    const indexed = await listIndexedChunkIds(CFG, DOC, TENANT);
    const report = reconcileIndexed(indexed, [CHUNK_A, CHUNK_B]);

    expect(report).toEqual({ ok: true, missing: [], orphan: [] });
    expect(seen[0]).toContain('refresh=wait_for');
    expect(seen[1]).toContain('/_search');
  });
});
