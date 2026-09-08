/**
 * 目标：ES 查询期按文档 aclPrincipals 收窄，缺字段=未设可读，空数组不可命中。
 * 需求：P3b 文档 ACL · 工单 ES 查询期 principals 对称最小闭环
 * 被测：buildAclFilter / aclPrincipalsFilterClause / searchSparseEs / sparseBulkSource / runRetrieve
 * 简介：不跟 DEPT_ACL_ENFORCE。超管不加 clause。PG 名单闸仍保留。显式空写哨兵，因 ES exists 不认空数组。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import {
  aclPrincipalsFilterClause,
  buildAclFilter,
  ACL_PRINCIPALS_NONE_SENTINEL,
  bulkIndexSparse,
  ensureSparseIndex,
  searchSparseEs,
  sparseBulkSource,
} from '../../src/services/retrieve/es-sparse.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';

const USER_A = '01900000-0000-7000-8000-0000000000a1';
const USER_B = '01900000-0000-7000-8000-0000000000b1';
const TENANT = 'tenant-a';
const KB = 'kb-1';
const dims = 8;

const retrieveKb = { configJson: {} as Record<string, unknown> };

vi.mock('../../src/services/kb-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/kb-settings.js')>();
  return {
    ...actual,
    kbSettingsRepo: {
      get: async () => ({
        id: KB,
        name: 'KB',
        description: null,
        configJson: retrieveKb.configJson,
      }),
    },
  };
});

vi.mock('../../src/services/departments.js', () => ({
  departmentsRepo: {
    listUserDepartments: async () => [],
    listDepartments: async () => [],
    getDepartment: async () => null,
  },
}));

vi.mock('../../src/services/dept-grants.js', () => ({
  deptGrantsRepo: {
    listGrants: async () => [],
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  retrieveKb.configJson = {};
});

function chunk(id: string, text: string): CorpusChunk {
  return {
    chunkId: id,
    docId: `doc-${id}`,
    title: `T-${id}`,
    text,
    preview: text.slice(0, 40),
    lifecycle: 'active',
    embedding: mockEmbedVector(text, dims),
  };
}

function retrieveDeps(
  corpus: CorpusChunk[],
  sparseSearch: RetrieveDeps['sparseSearch'],
): RetrieveDeps {
  return {
    loadCorpus: async () => corpus,
    embed: async (texts) => texts.map((t) => mockEmbedVector(t, dims)),
    rerank: async (query, passages, topN) => {
      const scored = passages
        .map((p, index) => ({ index, score: sparseOverlapScore(query, p) }))
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.min(topN, scored.length));
    },
    esMode: 'http',
    sparseSearch,
  };
}

describe('buildAclFilter aclPrincipals', () => {
  it('缺省 / 不 apply：只有 tenantId+kbId', () => {
    expect(buildAclFilter({ tenantId: TENANT, kbId: KB })).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
    ]);
    expect(buildAclFilter({ tenantId: TENANT, kbId: KB, applyAclPrincipals: false })).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
    ]);
  });

  it('apply + userId：must_not exists ∪ term', () => {
    expect(
      buildAclFilter({
        tenantId: TENANT,
        kbId: KB,
        applyAclPrincipals: true,
        aclPrincipalUserId: USER_A,
      }),
    ).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
      aclPrincipalsFilterClause(USER_A),
    ]);
  });

  it('apply 无 userId：只有 must_not exists', () => {
    expect(buildAclFilter({ tenantId: TENANT, kbId: KB, applyAclPrincipals: true })).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
      aclPrincipalsFilterClause(),
    ]);
    expect(aclPrincipalsFilterClause().bool.should).toEqual([
      { bool: { must_not: { exists: { field: 'aclPrincipals' } } } },
    ]);
  });
});

describe('searchSparseEs aclPrincipals', () => {
  it('apply 时 POST filter 含 should clause', async () => {
    let capturedBody: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? '{}'));
        return { ok: true, json: async () => ({ hits: { hits: [] } }) };
      }),
    );

    await searchSparseEs(
      { baseUrl: 'http://es:9200', index: 'strict_rag_dev' },
      {
        tenantId: TENANT,
        kbId: KB,
        question: '年假',
        size: 10,
        applyAclPrincipals: true,
        aclPrincipalUserId: USER_A,
      },
    );

    expect(capturedBody).toEqual(
      expect.objectContaining({
        query: {
          bool: {
            filter: [
              { term: { tenantId: TENANT } },
              { term: { kbId: KB } },
              aclPrincipalsFilterClause(USER_A),
            ],
            must: [{ match: { sparseText: '年假' } }],
          },
        },
      }),
    );
  });
});

describe('sparse mapping / bulk aclPrincipals', () => {
  it('ensureSparseIndex mapping 含 keyword aclPrincipals', async () => {
    let putBody: { mappings?: { properties?: { aclPrincipals?: unknown } } } = {};
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === 'HEAD') return { ok: false, status: 404 };
        putBody = JSON.parse(String(init?.body ?? '{}')) as typeof putBody;
        return { ok: true, text: async () => '' };
      }),
    );
    await ensureSparseIndex({ baseUrl: 'http://es:9200', index: 'ix' });
    expect(putBody.mappings?.properties?.aclPrincipals).toEqual({ type: 'keyword' });
  });

  it('bulk：null 不写；[] 写哨兵；非空写列表', () => {
    expect(
      sparseBulkSource({
        chunkId: 'c1',
        tenantId: TENANT,
        kbId: KB,
        docId: 'd1',
        sparseText: 'x',
        aclPrincipals: null,
      }),
    ).not.toHaveProperty('aclPrincipals');
    expect(
      sparseBulkSource({
        chunkId: 'c2',
        tenantId: TENANT,
        kbId: KB,
        docId: 'd1',
        sparseText: 'y',
        aclPrincipals: [],
      }).aclPrincipals,
    ).toEqual([ACL_PRINCIPALS_NONE_SENTINEL]);
    expect(
      sparseBulkSource({
        chunkId: 'c3',
        tenantId: TENANT,
        kbId: KB,
        docId: 'd1',
        sparseText: 'z',
        aclPrincipals: [USER_A, USER_B],
      }).aclPrincipals,
    ).toEqual([USER_A, USER_B]);
  });

  it('bulk ndjson 三态', async () => {
    let ndjson = '';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        ndjson = String(init?.body ?? '');
        return { ok: true, json: async () => ({ errors: false }) };
      }),
    );
    await bulkIndexSparse(
      { baseUrl: 'http://es:9200', index: 'ix' },
      [
        {
          chunkId: 'c1',
          tenantId: TENANT,
          kbId: KB,
          docId: 'd1',
          sparseText: 'x',
          aclPrincipals: null,
        },
        {
          chunkId: 'c2',
          tenantId: TENANT,
          kbId: KB,
          docId: 'd1',
          sparseText: 'y',
          aclPrincipals: [],
        },
        {
          chunkId: 'c3',
          tenantId: TENANT,
          kbId: KB,
          docId: 'd1',
          sparseText: 'z',
          aclPrincipals: [USER_A],
        },
      ],
    );
    const lines = ndjson.trim().split('\n');
    expect(JSON.parse(lines[1] ?? '{}')).not.toHaveProperty('aclPrincipals');
    expect(JSON.parse(lines[3] ?? '{}')).toMatchObject({
      aclPrincipals: [ACL_PRINCIPALS_NONE_SENTINEL],
    });
    expect(JSON.parse(lines[5] ?? '{}')).toMatchObject({ aclPrincipals: [USER_A] });
  });

  it('已有索引 PUT _mapping 补 aclPrincipals keyword', async () => {
    const calls: Array<{ url: string; method?: string; body?: string }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method, body: String(init?.body ?? '') });
        return { ok: true, text: async () => '' };
      }),
    );
    await ensureSparseIndex({ baseUrl: 'http://es:9200', index: 'ix' });
    expect(calls[0]?.method).toBe('HEAD');
    expect(calls[1]?.url).toContain('/_mapping');
    expect(calls[1]?.method).toBe('PUT');
    expect(JSON.parse(calls[1]?.body ?? '{}')).toEqual({
      properties: {
        ownerDeptId: { type: 'keyword' },
        aclPrincipals: { type: 'keyword' },
      },
    });
  });
});

describe('runRetrieve http 传入 applyAclPrincipals', () => {
  const corpus = [chunk('c1', 'employee leave policy allows 15 days annual leave')];

  it('成员：带 apply 与 userId，不跟 enforce', async () => {
    retrieveKb.configJson = {};
    let captured:
      | { applyAclPrincipals?: boolean; aclPrincipalUserId?: string; ownerDeptIds?: string[] }
      | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'member',
        userId: USER_A,
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.applyAclPrincipals).toBe(true);
    expect(captured?.aclPrincipalUserId).toBe(USER_A);
    expect(captured?.ownerDeptIds).toBeUndefined();
  });

  it('成员无 userId：apply 仍开，不传 userId', async () => {
    let captured: { applyAclPrincipals?: boolean; aclPrincipalUserId?: string } | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'member',
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.applyAclPrincipals).toBe(true);
    expect(captured?.aclPrincipalUserId).toBeUndefined();
  });

  it('enforce 开也不改变 principals（仍 apply）', async () => {
    retrieveKb.configJson = { deptAclEnforce: true };
    let captured: { applyAclPrincipals?: boolean; aclPrincipalUserId?: string } | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'member',
        userId: USER_A,
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.applyAclPrincipals).toBe(true);
    expect(captured?.aclPrincipalUserId).toBe(USER_A);
  });

  it('超管：无 principals clause', async () => {
    retrieveKb.configJson = { deptAclEnforce: true };
    let captured: { applyAclPrincipals?: boolean; aclPrincipalUserId?: string } | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'super_admin',
        userId: USER_A,
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.applyAclPrincipals).toBeUndefined();
    expect(captured?.aclPrincipalUserId).toBeUndefined();
  });
});
