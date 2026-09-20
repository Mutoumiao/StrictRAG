/**
 * 目标：路径只有 :docId（无 :kbId）的文档写入口必须校验 KB 成员资格——持码非成员不得写他库文档。
 * 需求：ADR-035 §决策 4（无 kb_members 行 → 该 KB 一切内容路径 403，含删文档）· ADR-045 焊死 #1（handler 纵深：中间件漏了也不放行写）· prds/09-security §3.2 / §3.4
 * 被测：PATCH /documents/:docId · PUT /documents/:docId/acl · POST /documents/:docId/dedupe-conflicts/:chunkId/resolve · PATCH /documents/:docId/lifecycle · POST /documents/:docId/approve
 * 简介：非成员 403「not a knowledge base member」且不落仓；成员 200；super_admin 非成员旁路；
 *      `whenEnforced` 入口的成员闸姿态随 AUTH_ENFORCE（关则不查，开则查）。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB_A = '01900000-0000-7000-8000-0000000000a1';
const KB_B = '01900000-0000-7000-8000-0000000000b1';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DOC_A = '01900000-0000-7000-8000-0000000000d1';
const DOC_B = '01900000-0000-7000-8000-0000000000d2';
const CHUNK_A = '01900000-0000-7000-8000-0000000000c1';
const UPLOADER = '01900000-0000-7000-8000-0000000000f1';
/** 审批人须异于提交人（ADR-048 #4 四眼），否则 403 来自自审闸而非本票要验的成员闸 */
const APPROVER = '01900000-0000-7000-8000-0000000000f2';

const state = {
  patchCalls: [] as unknown[],
  lifecycleCalls: [] as unknown[],
  approveCalls: [] as unknown[],
  resolveCalls: [] as unknown[],
};

function docRow(id: string, kbId: string) {
  return {
    id,
    title: `文档 ${id.slice(-2)}`,
    status: 'ready',
    approvalStatus: 'pending',
    lifecycle: 'draft' as string,
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
    uploadedBy: UPLOADER,
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
    patchMeta: async (_id: string, patch: unknown) => {
      state.patchCalls.push(patch);
    },
    setLifecycle: async (_id: string, lifecycle: string) => {
      state.lifecycleCalls.push(lifecycle);
    },
    approve: async (id: string, actor: string | null) => {
      state.approveCalls.push({ id, actor });
    },
  },
}));

vi.mock('../../src/services/dedupe-conflict.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/dedupe-conflict.js')>();
  return {
    ...actual,
    dedupeConflictRepo: {
      getChunk: async (docId: string, chunkId: string) =>
        docId === DOC_A && chunkId === CHUNK_A
          ? {
              chunkId: CHUNK_A,
              docId: DOC_A,
              kbId: KB_A,
              indexVersion: 1,
              dedupeStatus: 'pending_review',
              duplicateOf: null,
            }
          : null,
      resolve: async (input: unknown) => {
        state.resolveCalls.push(input);
      },
    },
  };
});

const { createDocumentRoutes } = await import('../../src/routes/documents/index.js');

/** 只把 KB-B 认成成员：KB-A 的写必须被库级成员闸挡住 */
function buildApp() {
  const resolveKbMember = async (_userId: string, kbId: string) => kbId === KB_B;
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDocumentRoutes({ resolveKbMember }));
  return app;
}

async function token(roles: string[] = ['kb_admin'], userId = UPLOADER) {
  const pair = await issueTokenPair({ userId, app: 'admin', roles, tenantId: TENANT });
  return pair.accessToken;
}

function jsonHeaders(accessToken: string) {
  return { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
}

async function expectMemberDenied(res: Response) {
  expect(res.status).toBe(403);
  const body = (await res.json()) as { error: { code: string; message: string } };
  expect(body.error.code).toBe('FORBIDDEN');
  expect(body.error.message).toContain('not a knowledge base member');
}

afterEach(() => {
  vi.unstubAllEnvs();
  state.patchCalls = [];
  state.lifecycleCalls = [];
  state.approveCalls = [];
  state.resolveCalls = [];
});

describe('路径只有 :docId 的文档写入口 · KB 成员闸', () => {
  it('PATCH /documents/:docId：非成员 403 且不写仓；成员 200；super_admin 非成员旁路', async () => {
    const app = buildApp();

    const denied = await app.request(`/api/v1/documents/${DOC_A}`, {
      method: 'PATCH',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ visibilityLevel: 30 }),
    });
    await expectMemberDenied(denied);
    expect(state.patchCalls).toHaveLength(0);

    const allowed = await app.request(`/api/v1/documents/${DOC_B}`, {
      method: 'PATCH',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ visibilityLevel: 30 }),
    });
    expect(allowed.status).toBe(200);
    expect(state.patchCalls).toHaveLength(1);

    const bypass = await app.request(`/api/v1/documents/${DOC_A}`, {
      method: 'PATCH',
      headers: jsonHeaders(await token(['super_admin'])),
      body: JSON.stringify({ visibilityLevel: 30 }),
    });
    expect(bypass.status).toBe(200);
    expect(state.patchCalls).toHaveLength(2);
  });

  it('PUT /documents/:docId/acl：非成员 403 且不改名单；成员 200 且回 reindexRequired', async () => {
    const app = buildApp();

    const denied = await app.request(`/api/v1/documents/${DOC_A}/acl`, {
      method: 'PUT',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ aclPrincipals: [UPLOADER] }),
    });
    await expectMemberDenied(denied);
    expect(state.patchCalls).toHaveLength(0);

    const allowed = await app.request(`/api/v1/documents/${DOC_B}/acl`, {
      method: 'PUT',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ aclPrincipals: [UPLOADER] }),
    });
    expect(allowed.status).toBe(200);
    const body = (await allowed.json()) as { data: { reindexRequired: boolean } };
    expect(body.data.reindexRequired).toBe(true);
    expect(state.patchCalls).toHaveLength(1);
  });

  it('POST dedupe-conflicts resolve：非成员 403 且不落决定；成员 200', async () => {
    const app = buildApp();

    const denied = await app.request(
      `/api/v1/documents/${DOC_A}/dedupe-conflicts/${CHUNK_A}/resolve`,
      {
        method: 'POST',
        headers: jsonHeaders(await token()),
        body: JSON.stringify({ winner: 'this' }),
      },
    );
    await expectMemberDenied(denied);
    expect(state.resolveCalls).toHaveLength(0);
  });

  it('whenEnforced 入口：AUTH_ENFORCE 关时不因成员闸被拦，开时非成员 403', async () => {
    const app = buildApp();

    const off = await app.request(`/api/v1/documents/${DOC_A}/lifecycle`, {
      method: 'PATCH',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ lifecycle: 'draft' }),
    });
    expect(off.status).toBe(200);
    expect(state.lifecycleCalls).toHaveLength(1);

    vi.stubEnv('AUTH_ENFORCE', 'true');
    const on = await app.request(`/api/v1/documents/${DOC_A}/lifecycle`, {
      method: 'PATCH',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ lifecycle: 'draft' }),
    });
    await expectMemberDenied(on);
    expect(state.lifecycleCalls).toHaveLength(1);

    const memberOk = await app.request(`/api/v1/documents/${DOC_B}/lifecycle`, {
      method: 'PATCH',
      headers: jsonHeaders(await token()),
      body: JSON.stringify({ lifecycle: 'draft' }),
    });
    expect(memberOk.status).toBe(200);
    expect(state.lifecycleCalls).toHaveLength(2);
  });

  it('POST approve：AUTH_ENFORCE 开时非成员 403 且不落审批', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const app = buildApp();

    const denied = await app.request(`/api/v1/documents/${DOC_A}/approve`, {
      method: 'POST',
      headers: jsonHeaders(await token(['kb_admin'], APPROVER)),
      body: JSON.stringify({}),
    });
    await expectMemberDenied(denied);
    expect(state.approveCalls).toHaveLength(0);

    const allowed = await app.request(`/api/v1/documents/${DOC_B}/approve`, {
      method: 'POST',
      headers: jsonHeaders(await token(['kb_admin'], APPROVER)),
      body: JSON.stringify({}),
    });
    expect(allowed.status).toBe(200);
    expect(state.approveCalls).toHaveLength(1);
  });
});
