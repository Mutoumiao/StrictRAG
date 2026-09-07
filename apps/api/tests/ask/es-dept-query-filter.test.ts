/**
 * 目标：ES 查询期按部门 ownerDeptId 收窄，缺字段不得当全员可见。
 * 需求：DEPT_ACL · 工单 ES 查询期部门对称最小闭环
 * 被测：buildAclFilter / searchSparseEs / collectVisibleOwnerDeptIds / runRetrieve http sparse
 * 简介：enforce 默认关。开且非超管才追加 terms；PG filterDocsForDeptAcl 仍保留。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { collectVisibleOwnerDeptIds } from '../../src/services/retrieve/dept-acl.js';
import {
  buildAclFilter,
  bulkIndexSparse,
  ensureSparseIndex,
  searchSparseEs,
  sparseBulkSource,
} from '../../src/services/retrieve/es-sparse.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';

const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';
const DEPT_C = '01900000-0000-7000-8000-0000000000c1';
const TENANT = 'tenant-a';
const KB = 'kb-1';
const dims = 8;

const tree = [
  { id: DEPT_A, path: `/${DEPT_A}/` },
  { id: DEPT_B, path: `/${DEPT_A}/${DEPT_B}/` },
  { id: DEPT_C, path: `/${DEPT_A}/${DEPT_C}/` },
];

const retrieveKb = { configJson: {} as Record<string, unknown> };
const deptState = {
  assignments: [] as Array<{ deptId: string; isLeader: number }>,
  depts: [] as Array<{ id: string; path: string }>,
};
const grantState = [] as Array<{
  deptId: string;
  maxVisibilityLevel: number;
  expiresAt: string | null;
}>;

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
    listUserDepartments: async () => deptState.assignments,
    listDepartments: async () => deptState.depts,
    getDepartment: async (_tenantId: string, id: string) =>
      deptState.depts.find((d) => d.id === id) ?? null,
  },
}));

vi.mock('../../src/services/dept-grants.js', () => ({
  deptGrantsRepo: {
    listGrants: async () => grantState,
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
  retrieveKb.configJson = {};
  deptState.assignments = [];
  deptState.depts = [];
  grantState.length = 0;
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

describe('buildAclFilter ownerDeptId', () => {
  it('缺省 / 空列表：只有 tenantId+kbId', () => {
    expect(buildAclFilter({ tenantId: TENANT, kbId: KB })).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
    ]);
    expect(buildAclFilter({ tenantId: TENANT, kbId: KB, ownerDeptIds: [] })).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
    ]);
  });

  it('非空 ownerDeptIds：追加 terms', () => {
    expect(
      buildAclFilter({ tenantId: TENANT, kbId: KB, ownerDeptIds: [DEPT_A, DEPT_B] }),
    ).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
      { terms: { ownerDeptId: [DEPT_A, DEPT_B] } },
    ]);
  });
});

describe('searchSparseEs ownerDeptId', () => {
  it('传入 ownerDeptIds 时 POST filter 含 terms', async () => {
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
        ownerDeptIds: [DEPT_A],
      },
    );

    expect(capturedBody).toEqual(
      expect.objectContaining({
        query: {
          bool: {
            filter: [
              { term: { tenantId: TENANT } },
              { term: { kbId: KB } },
              { terms: { ownerDeptId: [DEPT_A] } },
            ],
            must: [{ match: { sparseText: '年假' } }],
          },
        },
      }),
    );
  });
});

describe('sparse mapping / bulk', () => {
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
    await ensureSparseIndex({ baseUrl: 'http://es:9200', index: 'ix' });
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

  it('bulk 有值才写 ownerDeptId', async () => {
    expect(
      sparseBulkSource({
        chunkId: 'c1',
        tenantId: TENANT,
        kbId: KB,
        docId: 'd1',
        sparseText: 'x',
        ownerDeptId: DEPT_A,
      }).ownerDeptId,
    ).toBe(DEPT_A);
    expect(
      sparseBulkSource({
        chunkId: 'c2',
        tenantId: TENANT,
        kbId: KB,
        docId: 'd1',
        sparseText: 'y',
        ownerDeptId: null,
      }),
    ).not.toHaveProperty('ownerDeptId');
    expect(
      sparseBulkSource({
        chunkId: 'c3',
        tenantId: TENANT,
        kbId: KB,
        docId: 'd1',
        sparseText: 'z',
      }),
    ).not.toHaveProperty('ownerDeptId');

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
          ownerDeptId: DEPT_A,
        },
        {
          chunkId: 'c2',
          tenantId: TENANT,
          kbId: KB,
          docId: 'd1',
          sparseText: 'y',
          ownerDeptId: null,
        },
      ],
    );
    const lines = ndjson.trim().split('\n');
    expect(JSON.parse(lines[1] ?? '{}')).toMatchObject({ ownerDeptId: DEPT_A });
    expect(JSON.parse(lines[3] ?? '{}')).not.toHaveProperty('ownerDeptId');
  });
});

describe('collectVisibleOwnerDeptIds', () => {
  it('精确 ∪ inherit 子孙；grant 并入子树', () => {
    expect(
      collectVisibleOwnerDeptIds({
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        depts: tree,
        inheritDown: true,
      }),
    ).toEqual([DEPT_A, DEPT_B, DEPT_C].sort());

    expect(
      collectVisibleOwnerDeptIds({
        assignments: [{ deptId: DEPT_B, isLeader: false }],
        depts: tree,
        inheritDown: true,
      }),
    ).toEqual([DEPT_B]);

    expect(
      collectVisibleOwnerDeptIds({
        assignments: [],
        depts: tree,
        grants: [{ deptId: DEPT_A, maxVisibilityLevel: 20, expiresAt: null }],
      }),
    ).toEqual([DEPT_A, DEPT_B, DEPT_C].sort());
  });

  it('inherit false：归属只精确；grant 子树仍在', () => {
    expect(
      collectVisibleOwnerDeptIds({
        assignments: [{ deptId: DEPT_A, isLeader: true }],
        depts: tree,
        inheritDown: false,
      }),
    ).toEqual([DEPT_A]);
    expect(
      collectVisibleOwnerDeptIds({
        assignments: [{ deptId: DEPT_A, isLeader: true }],
        depts: tree,
        grants: [{ deptId: DEPT_A, maxVisibilityLevel: 20, expiresAt: null }],
        inheritDown: false,
      }),
    ).toEqual([DEPT_A, DEPT_B, DEPT_C].sort());
  });

  it('过期 grant 不入；无树只精确', () => {
    expect(
      collectVisibleOwnerDeptIds({
        assignments: [],
        depts: tree,
        grants: [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: '2000-01-01 00:00:00' }],
        now: '2026-08-17 12:00:00',
      }),
    ).toEqual([]);
    expect(
      collectVisibleOwnerDeptIds({
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        inheritDown: true,
      }),
    ).toEqual([DEPT_A]);
  });
});

describe('runRetrieve http 传入 ownerDeptIds', () => {
  const corpus = [chunk('c1', 'employee leave policy allows 15 days annual leave')];

  it('enforce 关：sparseSearch 不带 ownerDeptIds', async () => {
    retrieveKb.configJson = {};
    let captured: { ownerDeptIds?: string[] } | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'member',
        userId: 'u1',
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.ownerDeptIds).toBeUndefined();
  });

  it('enforce 开非超管：含可见部门 terms 列表', async () => {
    retrieveKb.configJson = { deptAclEnforce: true };
    deptState.assignments = [{ deptId: DEPT_A, isLeader: 0 }];
    deptState.depts = tree;
    let captured: { ownerDeptIds?: string[] } | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'member',
        userId: 'u1',
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.ownerDeptIds?.slice().sort()).toEqual([DEPT_A, DEPT_B, DEPT_C].sort());
  });

  it('超管：无部门 terms', async () => {
    retrieveKb.configJson = { deptAclEnforce: true };
    deptState.assignments = [{ deptId: DEPT_A, isLeader: 0 }];
    deptState.depts = tree;
    let captured: { ownerDeptIds?: string[] } | undefined;
    const r = await runRetrieve(
      {
        tenantId: TENANT,
        kbId: KB,
        question: 'annual leave',
        membership: 'super_admin',
        userId: 'u1',
        rerankTopN: 2,
      },
      retrieveDeps(corpus, async (input) => {
        captured = input;
        return ['c1'];
      }),
    );
    expect(r.ok).toBe(true);
    expect(captured?.ownerDeptIds).toBeUndefined();
  });
});
