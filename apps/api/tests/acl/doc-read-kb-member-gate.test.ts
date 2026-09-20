/**
 * 目标：路径只有 :docId 的文档读入口必须校验 KB 成员资格——持码非成员不得读他库文档元数据、ACL 名单与分片正文。
 * 需求：ADR-035 §决策 4（无 kb_members 行 → 该 KB 一切内容路径 403，含读文档内容/列表）· ADR-057 决策 2（可见文档 = KB 成员 ∧ ready ∧ active ∧ …）· prds/09-security §3.2
 * 被测：GET /documents/:docId · GET …/acl · GET …/ingest-jobs · GET …/chunks · GET …/chunks/:chunkId
 * 简介：非成员 403 且不返回正文 / 名单 / 账本（数据仓零调用）；成员 200；super_admin 非成员旁路；
 *      `chunk.view` 两个入口是硬姿态（始终查），`doc.view` 三个随 AUTH_ENFORCE（关不查、开查）。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createMemoryChunksRepo, type ChunkRow, type ChunksRepo } from '../../src/services/chunks.js';

const KB_A = '01900000-0000-7000-8000-0000000000a1';
const KB_B = '01900000-0000-7000-8000-0000000000b1';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DOC_A = '01900000-0000-7000-8000-0000000000d1';
const DOC_B = '01900000-0000-7000-8000-0000000000d2';
const CHUNK_A = '01900000-0000-7000-8000-0000000000c1';
const USER = '01900000-0000-7000-8000-0000000000e1';

const ledgerCalls = { count: 0 };

function docRow(id: string, kbId: string) {
  return {
    id,
    title: `文档 ${id.slice(-2)}`,
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'active',
    byteSize: 12,
    indexVersion: 1,
    errorCode: null,
    embedReady: 1,
    esReady: 1,
    tenantId: TENANT,
    kbId,
    sourceType: 'upload',
    contentType: 'text/plain',
    errorMessage: null,
    docType: null,
    uploadedBy: USER,
    chunkStrategy: 'fixed',
    chunkStrategyParams: {},
    supersedesDocId: null,
    supersededByDocId: null,
    effectiveFrom: null,
    effectiveTo: null,
    createdAt: '2026-08-01 10:00:00',
    updatedAt: '2026-08-02 11:00:00',
    ownerDeptId: null,
    visibilityLevel: 20,
    aclPrincipals: null as string[] | null,
  };
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC_A ? docRow(DOC_A, KB_A) : id === DOC_B ? docRow(DOC_B, KB_B) : null,
    getKb: async (id: string) =>
      id === KB_A || id === KB_B ? { id, tenantId: TENANT, configJson: {} } : null,
  },
}));

vi.mock('../../src/services/ingest-jobs.js', () => ({
  ingestJobsRepo: {
    listByDocId: async () => {
      ledgerCalls.count += 1;
      return [];
    },
  },
}));

const { createDocumentRoutes } = await import('../../src/routes/documents/index.js');
const { createChunkRoutes } = await import('../../src/routes/chunks.js');

/** 只把 KB-B 认成成员：KB-A 的读必须被库级成员闸挡住 */
const resolveKbMember = async (_userId: string, kbId: string) => kbId === KB_B;

const chunkSeed = {
  docs: [
    {
      id: DOC_A,
      kbId: KB_A,
      tenantId: TENANT,
      indexVersion: 1,
      status: 'ready',
      lifecycle: 'active',
      ownerDeptId: null,
      visibilityLevel: 20,
      aclPrincipals: null,
    },
    {
      id: DOC_B,
      kbId: KB_B,
      tenantId: TENANT,
      indexVersion: 1,
      status: 'ready',
      lifecycle: 'active',
      ownerDeptId: null,
      visibilityLevel: 20,
      aclPrincipals: null,
    },
  ] as never,
  chunks: [
    {
      id: CHUNK_A,
      docId: DOC_A,
      indexVersion: 1,
      ordinal: 0,
      preview: 'preview-a',
      bodyText: 'body a',
      tokenCount: 3,
    },
    {
      id: '01900000-0000-7000-8000-0000000000c2',
      docId: DOC_B,
      indexVersion: 1,
      ordinal: 0,
      preview: 'preview-b',
      bodyText: 'body b',
      tokenCount: 3,
    },
  ] as ChunkRow[],
};

function buildDocApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDocumentRoutes({ resolveKbMember }));
  return app;
}

function buildChunkApp() {
  const repo: ChunksRepo = createMemoryChunksRepo(chunkSeed);
  const listSpy = vi.spyOn(repo, 'listByDocVersion');
  const detailSpy = vi.spyOn(repo, 'getById');
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createChunkRoutes({ chunks: repo, resolveKbMember }));
  return { app, listSpy, detailSpy };
}

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({ userId: USER, app: 'admin', roles, tenantId: TENANT });
  return pair.accessToken;
}

function headers(accessToken: string) {
  return { authorization: `Bearer ${accessToken}` };
}

async function expectMemberDenied(res: Response) {
  expect(res.status).toBe(403);
  const body = (await res.json()) as { error: { code: string; message: string } };
  expect(body.error.code).toBe('FORBIDDEN');
  expect(body.error.message).toContain('not a knowledge base member');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  ledgerCalls.count = 0;
});

describe('路径只有 :docId 的文档读入口 · KB 成员闸', () => {
  it('GET /documents/:docId：AUTH_ENFORCE 关时不查（不翻转默认），开时非成员 403、成员与超管 200', async () => {
    const app = buildDocApp();

    const off = await app.request(`/api/v1/documents/${DOC_A}`, {
      headers: headers(await token()),
    });
    expect(off.status).toBe(200);

    vi.stubEnv('AUTH_ENFORCE', 'true');
    const denied = await app.request(`/api/v1/documents/${DOC_A}`, {
      headers: headers(await token()),
    });
    await expectMemberDenied(denied);

    const memberOk = await app.request(`/api/v1/documents/${DOC_B}`, {
      headers: headers(await token()),
    });
    expect(memberOk.status).toBe(200);

    const bypass = await app.request(`/api/v1/documents/${DOC_A}`, {
      headers: headers(await token(['super_admin'])),
    });
    expect(bypass.status).toBe(200);
  });

  it('GET /documents/:docId/acl：非成员拿不到名单，超管旁路仍 200', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const app = buildDocApp();

    const denied = await app.request(`/api/v1/documents/${DOC_A}/acl`, {
      headers: headers(await token()),
    });
    await expectMemberDenied(denied);

    const bypass = await app.request(`/api/v1/documents/${DOC_A}/acl`, {
      headers: headers(await token(['super_admin'])),
    });
    expect(bypass.status).toBe(200);
  });

  it('GET /documents/:docId/ingest-jobs：非成员 403 且不读账本；成员 200', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const app = buildDocApp();

    const denied = await app.request(`/api/v1/documents/${DOC_A}/ingest-jobs`, {
      headers: headers(await token()),
    });
    await expectMemberDenied(denied);
    expect(ledgerCalls.count).toBe(0);

    const memberOk = await app.request(`/api/v1/documents/${DOC_B}/ingest-jobs`, {
      headers: headers(await token()),
    });
    expect(memberOk.status).toBe(200);
    expect(ledgerCalls.count).toBe(1);
  });

  it('GET …/chunks 与 …/chunks/:chunkId：硬姿态（与 AUTH_ENFORCE 无关）非成员 403 且不读分片仓', async () => {
    const { app, listSpy, detailSpy } = buildChunkApp();

    const deniedList = await app.request(`/api/v1/documents/${DOC_A}/chunks`, {
      headers: headers(await token(['kb_admin'])),
    });
    await expectMemberDenied(deniedList);
    expect(listSpy).not.toHaveBeenCalled();

    const deniedDetail = await app.request(`/api/v1/documents/${DOC_A}/chunks/${CHUNK_A}`, {
      headers: headers(await token(['kb_admin'])),
    });
    await expectMemberDenied(deniedDetail);
    expect(detailSpy).not.toHaveBeenCalled();

    const memberList = await app.request(`/api/v1/documents/${DOC_B}/chunks`, {
      headers: headers(await token(['kb_admin'])),
    });
    expect(memberList.status).toBe(200);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });
});
