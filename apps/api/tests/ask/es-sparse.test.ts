/**
 * 目标：稀疏检索 HTTP 切片按 env 解析，失败不得静默回 mock。
 * 需求：OPS-1
 * 被测：esConfigFromEnv / searchSparseEs / buildAclFilter
 * 简介：稀疏检索 HTTP 切片；ACL filter 默认可选部门 terms；名单 clause 另见 es-principals-query-filter。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildAclFilter,
  EsSparseError,
  esConfigFromEnv,
  searchSparseEs,
  sparseBulkSource,
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

  it('空 ownerDeptIds 不加部门 terms', () => {
    expect(buildAclFilter({ tenantId: 't-1', kbId: 'kb-1', ownerDeptIds: [] })).toEqual([
      { term: { tenantId: 't-1' } },
      { term: { kbId: 'kb-1' } },
    ]);
  });

  it('非空 ownerDeptIds 追加 terms', () => {
    expect(
      buildAclFilter({ tenantId: 't-1', kbId: 'kb-1', ownerDeptIds: ['dept-a'] }),
    ).toEqual([
      { term: { tenantId: 't-1' } },
      { term: { kbId: 'kb-1' } },
      { terms: { ownerDeptId: ['dept-a'] } },
    ]);
  });

  it('不传 maxVisibleLevel 不加级别组（旧行为逐位不变）', () => {
    expect(
      buildAclFilter({ tenantId: 't-1', kbId: 'kb-1', ownerDeptIds: ['dept-a'] }),
    ).toHaveLength(3);
  });

  it('传 maxVisibleLevel 时追加级别组（range + 缺字段放行）', () => {
    expect(
      buildAclFilter({
        tenantId: 't-1',
        kbId: 'kb-1',
        ownerDeptIds: ['dept-a'],
        maxVisibleLevel: 30,
      }),
    ).toEqual([
      { term: { tenantId: 't-1' } },
      { term: { kbId: 'kb-1' } },
      { terms: { ownerDeptId: ['dept-a'] } },
      {
        bool: {
          should: [
            { range: { visibilityLevel: { lte: 30 } } },
            { bool: { must_not: { exists: { field: 'visibilityLevel' } } } },
          ],
          minimum_should_match: 1,
        },
      },
    ]);
  });

  it('级别组与部门组是 filter 数组的两个独立元素（并进同一 should 即放松）', () => {
    const filter = buildAclFilter({
      tenantId: 't-1',
      kbId: 'kb-1',
      ownerDeptIds: ['dept-a'],
      maxVisibleLevel: 20,
      applyAclPrincipals: true,
      aclPrincipalUserId: 'u-1',
    });
    expect(filter).toHaveLength(5);
    const dept = filter[2] as { terms?: unknown; bool?: { should?: unknown[] } };
    expect(dept.terms).toEqual({ ownerDeptId: ['dept-a'] });
    const level = filter[3] as { bool: { should: unknown[] } };
    expect(level.bool.should).toHaveLength(2);
    expect(JSON.stringify(level)).not.toContain('ownerDeptId');
  });
});

describe('sparseBulkSource visibilityLevel', () => {
  const base = { chunkId: 'c1', tenantId: 't-1', kbId: 'kb-1', docId: 'd1', sparseText: 'x' };

  it('有值即写；缺省 / null 不写', () => {
    expect(sparseBulkSource({ ...base, visibilityLevel: 20 }).visibilityLevel).toBe(20);
    expect(sparseBulkSource(base)).not.toHaveProperty('visibilityLevel');
    expect(sparseBulkSource({ ...base, visibilityLevel: null })).not.toHaveProperty(
      'visibilityLevel',
    );
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

describe('剧本 O2 · Router 默认指向共享索引名', () => {
  it('env 无路由覆盖时查询只打共享名 strict_rag_dev，且 filter 仍是 tenant+kb', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ hits: { hits: [] } }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const cfg = esConfigFromEnv({ ELASTICSEARCH_URL: 'http://es:9200' });
    expect(cfg).not.toBeNull();
    expect(cfg!.index).toBe('strict_rag_dev');

    const ids = await searchSparseEs(cfg!, {
      tenantId: 'tenant-1',
      kbId: 'kb-1',
      question: 'leave',
      size: 5,
    });
    expect(ids).toEqual([]);

    const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(call[0])).toBe('http://es:9200/strict_rag_dev/_search');
    expect(call[1].method).toBe('POST');
    const body = JSON.parse(String(call[1].body)) as {
      query: { bool: { filter: unknown[] } };
    };
    expect(body.query.bool.filter).toEqual([
      { term: { tenantId: 'tenant-1' } },
      { term: { kbId: 'kb-1' } },
    ]);
  });
});
