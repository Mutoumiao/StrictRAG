/**
 * 目标：文档列表 / 详情 / 分片预览 / ask 语料四个入口必须由「同一可见性函数」裁决，同一夹具下产出一致的可见集合。
 * 需求：P3b 出口第 1 条 · ADR-057「列表预览、chunk 查看、ask evidence 同一可见性函数」
 * 被测：visibility.ts 的 loadVisibilityContext / isDocVisible / filterVisibleDocs（经四个真实入口间接调用）
 * 简介：开强制 / 关强制 / 超管三态下四个面可见集合一致且等于预期；名单闸不随部门闸关闭而失效。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createMemoryChunksRepo, type ChunkRow } from '../../src/services/chunks.js';
import { createChunkRoutes } from '../../src/routes/chunks.js';
import { createDocumentRoutes } from '../../src/routes/documents/index.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = '01900000-0000-7000-8000-0000000000aa';
const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';
const USER = '01900000-0000-7000-8000-0000000000ee';
const OTHER = '01900000-0000-7000-8000-0000000000ff';

const LIB = '01900000-0000-7000-8000-0000000000d1';
const A20 = '01900000-0000-7000-8000-0000000000d2';
const A30 = '01900000-0000-7000-8000-0000000000d3';
const B20 = '01900000-0000-7000-8000-0000000000d4';
const P20 = '01900000-0000-7000-8000-0000000000d5';
const ALL_DOCS = [LIB, A20, A30, B20, P20];

const state = {
  kbConfig: {} as Record<string, unknown>,
  assignments: [] as { deptId: string; isLeader: boolean }[],
};

/** 五篇文档覆盖四种裁决来源：空部门 / 同部门 / 级别不足 / 跨部门 / 名单不含 */
const DOC_FIXTURES: Array<{
  id: string;
  ownerDeptId: string | null;
  visibilityLevel: number;
  aclPrincipals: string[] | null;
}> = [
  { id: LIB, ownerDeptId: null, visibilityLevel: 20, aclPrincipals: null },
  { id: A20, ownerDeptId: DEPT_A, visibilityLevel: 20, aclPrincipals: null },
  { id: A30, ownerDeptId: DEPT_A, visibilityLevel: 30, aclPrincipals: null },
  { id: B20, ownerDeptId: DEPT_B, visibilityLevel: 20, aclPrincipals: null },
  { id: P20, ownerDeptId: null, visibilityLevel: 20, aclPrincipals: [OTHER] },
];

function docRow(f: (typeof DOC_FIXTURES)[number]) {
  return {
    id: f.id,
    title: f.id,
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'active',
    byteSize: 12,
    indexVersion: 1,
    errorCode: null,
    embedReady: 1,
    esReady: 1,
    tenantId: TENANT,
    kbId: KB,
    ownerDeptId: f.ownerDeptId,
    visibilityLevel: f.visibilityLevel,
    aclPrincipals: f.aclPrincipals,
    docType: 'policy',
    effectiveFrom: null,
    effectiveTo: null,
  };
}

/** PG 侧语料装载的原始行（loadCorpusFromDb 走这些表） */
const store = {
  documents: DOC_FIXTURES.map(docRow),
  chunks: DOC_FIXTURES.map(
    (f, i) =>
      ({
        id: `01900000-0000-7000-8000-0000000001${String(i).padStart(2, '0')}`,
        docId: f.id,
        kbId: KB,
        indexVersion: 1,
        ordinal: 0,
        preview: `preview-${f.id}`,
        bodyText: `body-${f.id}`,
        tokenCount: 1,
      }) satisfies Record<string, unknown>,
  ),
};

vi.mock('../../src/services/db.js', async () => {
  const tables = await import('@strict-rag/db');
  return {
    getDb: () => ({
      select: () => ({
        from: (table: unknown) => ({
          where: async () => {
            if (table === tables.documents) return store.documents;
            if (table === tables.chunks) return store.chunks;
            return [];
          },
        }),
      }),
    }),
  };
});

vi.mock('../../src/services/kb-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/kb-settings.js')>();
  return {
    ...actual,
    kbSettingsRepo: {
      get: async (kbId: string) =>
        kbId === KB ? { id: KB, tenantId: TENANT, configJson: state.kbConfig } : null,
    },
  };
});

vi.mock('../../src/services/retrieve/dept-acl.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/retrieve/dept-acl.js')>();
  return {
    ...actual,
    loadDeptAssignments: async () => state.assignments,
    loadDeptNodes: async () => [],
    loadDeptGrants: async () => [],
  };
});

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (docId: string) => {
      const f = DOC_FIXTURES.find((d) => d.id === docId);
      return f ? docRow(f) : null;
    },
    getKb: async (kbId: string) =>
      kbId === KB ? { id: KB, tenantId: TENANT, configJson: state.kbConfig } : null,
    listDocsByKb: async () => DOC_FIXTURES.map(docRow),
  },
}));

const { loadCorpusFromDb } = await import('../../src/services/retrieve/corpus.js');

// 成员闸桩：本文件主题是「同一可见性函数」，成员资格统一放行（闸本身由 doc-read-kb-member-gate 覆盖）
const resolveKbMember = async () => true;

async function setup(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId: USER,
    app: 'admin',
    roles,
    email: 'visibility@test.local',
    tenantId: TENANT,
  });
  const headers = { authorization: `Bearer ${pair.accessToken}` };
  const chunksRepo = createMemoryChunksRepo({
    docs: DOC_FIXTURES.map((f) => ({
      id: f.id,
      indexVersion: 1,
      status: 'ready',
      lifecycle: 'active',
      tenantId: TENANT,
      kbId: KB,
      ownerDeptId: f.ownerDeptId,
      visibilityLevel: f.visibilityLevel,
      aclPrincipals: f.aclPrincipals,
    })),
    chunks: store.chunks as unknown as ChunkRow[],
  });
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDocumentRoutes({ resolveKbMember }));
  app.route('/api/v1', createChunkRoutes({ chunks: chunksRepo, resolveKbMember }));
  return { app, headers };
}

function sorted(ids: readonly string[]): string[] {
  return [...ids].sort();
}

/** 面 ①：文档列表 */
async function viaList(app: Hono<{ Variables: AuthVariables }>, headers: Record<string, string>) {
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents`, { headers });
  expect(res.status).toBe(200);
  const body = (await res.json()) as { data: Array<{ id: string }> };
  return body.data.map((d) => d.id);
}

/** 面 ② / ③：逐文档读入口（200 = 可见，403 = 被闸拦） */
async function viaDocRead(
  app: Hono<{ Variables: AuthVariables }>,
  headers: Record<string, string>,
  path: (docId: string) => string,
) {
  const visible: string[] = [];
  for (const id of ALL_DOCS) {
    const res = await app.request(path(id), { headers });
    if (res.status === 200) visible.push(id);
    else expect({ id, status: res.status }).toEqual({ id, status: 403 });
  }
  return visible;
}

/** 面 ④：ask 语料装载（走真实 loadCorpusFromDb）；超管在检索层经 membership 槽压低，故显式传 bypass */
async function viaCorpus(bypass = false) {
  const chunks = await loadCorpusFromDb({ kbId: KB, userId: USER, bypassDeptAcl: bypass });
  return [...new Set(chunks.map((c) => c.docId))];
}

async function allFourSurfaces(roles: string[] = ['kb_admin'], corpusBypass = false) {
  const { app, headers } = await setup(roles);
  return {
    list: await viaList(app, headers),
    detail: await viaDocRead(app, headers, (id) => `/api/v1/documents/${id}`),
    chunks: await viaDocRead(app, headers, (id) => `/api/v1/documents/${id}/chunks`),
    corpus: await viaCorpus(corpusBypass),
  };
}

afterEach(() => {
  state.kbConfig = {};
  state.assignments = [];
});

describe('四个读入口共用同一可见性函数（ADR-057）', () => {
  it('开强制 + 同部门普通成员：四个面产出同一集合', async () => {
    state.kbConfig = { deptAclEnforce: true };
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];
    const surfaces = await allFourSurfaces();

    // 非空转：先钉住预期，再要求四个面一致
    expect(sorted(surfaces.list)).toEqual(sorted([LIB, A20]));
    expect(new Set(surfaces.detail)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.chunks)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.corpus)).toEqual(new Set(surfaces.list));
  });

  it('关强制：部门闸整体不生效，但名单闸仍在（四个面一致）', async () => {
    state.assignments = [{ deptId: DEPT_A, isLeader: false }];
    const surfaces = await allFourSurfaces();

    // P20 的名单不含该用户 → 即便部门闸关也不可见
    expect(sorted(surfaces.list)).toEqual(sorted([LIB, A20, A30, B20]));
    expect(new Set(surfaces.detail)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.chunks)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.corpus)).toEqual(new Set(surfaces.list));
  });

  it('开强制 + super_admin：旁路对四个面同时生效', async () => {
    state.kbConfig = { deptAclEnforce: true };
    state.assignments = [];
    const surfaces = await allFourSurfaces(['super_admin'], true);

    expect(sorted(surfaces.list)).toEqual(sorted(ALL_DOCS));
    expect(new Set(surfaces.detail)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.chunks)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.corpus)).toEqual(new Set(surfaces.list));
  });

  it('开强制 + 无归属：只见空部门且级别够的文档（四个面一致）', async () => {
    state.kbConfig = { deptAclEnforce: true };
    state.assignments = [];
    const surfaces = await allFourSurfaces();

    expect(sorted(surfaces.list)).toEqual(sorted([LIB]));
    expect(new Set(surfaces.detail)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.chunks)).toEqual(new Set(surfaces.list));
    expect(new Set(surfaces.corpus)).toEqual(new Set(surfaces.list));
  });
});
