/**
 * 目标：稀疏索引 HTTP 配置与对账不得静默错配；mapping/bulk 须带 ownerDeptId。
 * 需求：OPS-1 · DEPT_ACL
 * 被测：esHttpConfigFromEnv · sparseTextForChunk · reconcileIndexed · ensureSparseIndex · bulkIndexSparse
 * 简介：空 URL 为 null；chunk 文本拼接；missing/orphan；无部门不写该字段。
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  bulkIndexSparse,
  ensureSparseIndex,
  esHttpConfigFromEnv,
  reconcileIndexed,
  sparseBulkSource,
  sparseTextForChunk,
} from '../../src/ingest/es-http.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('esHttpConfigFromEnv', () => {
  it('null when URL empty', () => {
    expect(esHttpConfigFromEnv({ ELASTICSEARCH_URL: '' })).toBeNull();
  });

  it('defaults index', () => {
    expect(esHttpConfigFromEnv({ ELASTICSEARCH_URL: 'http://es:9200' })).toEqual({
      baseUrl: 'http://es:9200',
      index: 'strict_rag_dev',
    });
  });
});

describe('sparseTextForChunk', () => {
  it('joins prefix and body', () => {
    expect(sparseTextForChunk('title / section', '正文段落')).toBe('title / section\n正文段落');
  });

  it('body only when prefix empty', () => {
    expect(sparseTextForChunk('  ', '正文')).toBe('正文');
  });
});

describe('reconcileIndexed', () => {
  it('ok when sets match', () => {
    expect(reconcileIndexed(['c2', 'c1'], ['c1', 'c2']).ok).toBe(true);
  });

  it('reports missing and orphan', () => {
    const r = reconcileIndexed(['c1', 'extra'], ['c1', 'c2']);
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['c2']);
    expect(r.orphan).toEqual(['extra']);
  });
});

describe('ownerDeptId mapping / bulk', () => {
  const cfg = { baseUrl: 'http://es:9200', index: 'strict_rag_dev' };

  it('ensureSparseIndex mapping 含 keyword ownerDeptId', async () => {
    let putBody: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'HEAD') return { ok: false, status: 404 };
        putBody = JSON.parse(String(init?.body ?? '{}'));
        return { ok: true, text: async () => '' };
      }),
    );
    await ensureSparseIndex(cfg);
    expect(putBody).toEqual({
      mappings: {
        properties: {
          chunkId: { type: 'keyword' },
          tenantId: { type: 'keyword' },
          kbId: { type: 'keyword' },
          docId: { type: 'keyword' },
          ownerDeptId: { type: 'keyword' },
          sparseText: { type: 'text' },
        },
      },
    });
  });

  it('bulk 有 ownerDeptId 才写入字段', async () => {
    let ndjson = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        ndjson = String(init?.body ?? '');
        return { ok: true, json: async () => ({ errors: false }) };
      }),
    );
    await bulkIndexSparse(cfg, [
      {
        chunkId: 'c1',
        tenantId: 't',
        kbId: 'k',
        docId: 'd',
        sparseText: 'x',
        ownerDeptId: '01900000-0000-7000-8000-0000000000a1',
      },
      {
        chunkId: 'c2',
        tenantId: 't',
        kbId: 'k',
        docId: 'd',
        sparseText: 'y',
        ownerDeptId: null,
      },
    ]);
    const lines = ndjson.trim().split('\n');
    const doc1 = JSON.parse(lines[1] ?? '{}') as { ownerDeptId?: string };
    const doc2 = JSON.parse(lines[3] ?? '{}') as { ownerDeptId?: string };
    expect(doc1.ownerDeptId).toBe('01900000-0000-7000-8000-0000000000a1');
    expect(doc2).not.toHaveProperty('ownerDeptId');
  });

  it('无部门文档 sparseBulkSource 不含 ownerDeptId', () => {
    expect(
      sparseBulkSource({
        chunkId: 'c1',
        tenantId: 't',
        kbId: 'k',
        docId: 'd',
        sparseText: 'x',
      }),
    ).not.toHaveProperty('ownerDeptId');
  });
});
