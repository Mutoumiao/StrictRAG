/**
 * 目标：稀疏检索 HTTP 切片按 env 解析，失败不得静默回 mock。
 * 需求：OPS-1
 * 被测：esConfigFromEnv / searchSparseEs
 * 简介：稀疏检索 HTTP 切片。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAclFilter,
  EsSparseError,
  esConfigFromEnv,
  searchSparseEs,
} from '../../src/services/retrieve/es-sparse.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('esConfigFromEnv', () => {
  it('null when URL empty', () => {
    expect(esConfigFromEnv({ ELASTICSEARCH_URL: '' })).toBeNull();
  });

  it('defaults index', () => {
    expect(esConfigFromEnv({ ELASTICSEARCH_URL: 'http://es:9200' })).toEqual({
      baseUrl: 'http://es:9200',
      index: 'strict_rag_dev',
    });
  });
});

describe('buildAclFilter', () => {
  it('强制 tenantId + kbId（共享索引安全隔离）', () => {
    expect(buildAclFilter({ tenantId: 't-1', kbId: 'kb-1' })).toEqual([
      { term: { tenantId: 't-1' } },
      { term: { kbId: 'kb-1' } },
    ]);
  });
});

describe('searchSparseEs', () => {
  it('returns ordered chunkIds from hits', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          hits: {
            hits: [
              { _id: 'c1', _source: { chunkId: 'c1' } },
              { _id: 'c2', _source: { chunkId: 'c2' } },
            ],
          },
        }),
      })),
    );
    const ids = await searchSparseEs(
      { baseUrl: 'http://es:9200', index: 'strict_rag_dev' },
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'leave', size: 10 },
    );
    expect(ids).toEqual(['c1', 'c2']);
  });

  it('HTTP error → EsSparseError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        text: async () => 'unavailable',
      })),
    );
    await expect(
      searchSparseEs(
        { baseUrl: 'http://es:9200', index: 'ix' },
        { tenantId: 't', kbId: 'k', question: 'q', size: 5 },
      ),
    ).rejects.toBeInstanceOf(EsSparseError);
  });
});
