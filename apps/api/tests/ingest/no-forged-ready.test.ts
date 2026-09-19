/**
 * 目标：不存在「跳过审批直写 ready」的 API；approve 也不等于 ready（不得凭审批上架或标就绪）。
 * 需求：剧本 V6 · 剧本 V8 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048
 * 被测：PATCH /documents/:docId · PATCH /documents/:docId/lifecycle · POST /documents/:docId/approve · POST …/scan
 * 简介：夹带的 status 字段被 400 拒绝且不写仓；不存在 /documents/:docId/status 路由（404）；
 *       未批 scan 403；approve 后文档仍非 ready → PATCH active 409。无真 PG。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d8';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  approvalStatus: 'pending' as string,
  status: 'uploaded',
  lifecycle: 'draft',
  patchCalls: [] as Array<Record<string, unknown>>,
  lifecycleCalls: [] as string[],
};

const enqueueState = { calls: [] as Array<{ docId: string; stage: string }> };

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            title: 'policy.pdf',
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: 'structure_paragraph',
            approvalStatus: docState.approvalStatus,
            status: docState.status,
            lifecycle: docState.lifecycle,
            uploadedBy: null,
            ownerDeptId: null,
            aclPrincipals: null,
            docType: null,
            effectiveFrom: null,
            effectiveTo: null,
          }
        : null,
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    patchMeta: async (_id: string, patch: Record<string, unknown>) => {
      docState.patchCalls.push(patch);
    },
    setLifecycle: async (_id: string, lifecycle: string) => {
      docState.lifecycleCalls.push(lifecycle);
      docState.lifecycle = lifecycle;
    },
    approve: async () => {
      docState.approvalStatus = 'approved';
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: { docId: string; stage: string }) => {
    enqueueState.calls.push({ docId: data.docId, stage: data.stage });
    return 'job-scan-1';
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

async function token() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['super_admin'],
    tenantId: TENANT,
  });
  return pair.accessToken;
}

async function patch(path: string, body: unknown) {
  const app = buildApp();
  return app.request(`/api/v1${path}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  docState.approvalStatus = 'pending';
  docState.status = 'uploaded';
  docState.lifecycle = 'draft';
  docState.patchCalls = [];
  docState.lifecycleCalls = [];
  enqueueState.calls = [];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('剧本 V6 · 伪造直写 ready 不存在', () => {
  it('夹带 status=ready 的 PATCH 被拒且不写仓；/documents/:docId/status 无路由', async () => {
    expect((await patch(`/documents/${DOC}`, { status: 'ready' })).status).toBe(400);
    expect(docState.patchCalls).toEqual([]);

    expect((await patch(`/documents/${DOC}/status`, { status: 'ready' })).status).toBe(404);
    expect(docState.patchCalls).toEqual([]);
    expect(docState.status).toBe('uploaded');
  });

  it('未批不得入扫描（另一条直写 ready 的通路也被堵）', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/scan`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token()}` },
    });

    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('FORBIDDEN');
    expect(enqueueState.calls).toEqual([]);
  });
});

describe('剧本 V8 · approve 不等于 ready', () => {
  it('approve 200 后：非 ready 不可 active，也不得夹带 status=ready', async () => {
    const app = buildApp();
    const accessToken = await token();
    const approved = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(approved.status).toBe(200);
    expect(docState.approvalStatus).toBe('approved');

    const res = await app.request(`/api/v1/documents/${DOC}/lifecycle`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ lifecycle: 'active' }),
    });
    expect(res.status).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('CONFLICT');
    expect(docState.lifecycleCalls).toEqual([]);

    // approve 后仍不得经 PATCH 夹带 status
    const forged = await patch(`/documents/${DOC}`, { status: 'ready' });
    expect(forged.status).toBe(400);
    expect(docState.patchCalls).toEqual([]);
    expect(docState.status).toBe('uploaded');
  });
});
