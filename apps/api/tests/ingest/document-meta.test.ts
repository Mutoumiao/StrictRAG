/**
 * 目标：文档元数据 PATCH 正确处理部门两字段。
 * 需求：P3b-META
 * 被测：documents meta PATCH
 * 简介：部门两字段。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DEPT = '01900000-0000-7000-8000-0000000000de';

const docState = {
  exists: true,
  ownerDeptId: null as string | null,
  visibilityLevel: 20 as number,
  lifecycle: 'active',
  patchCalls: [] as Array<{ ownerDeptId?: string | null; visibilityLevel?: number }>,
};

function mockRow() {
  return {
    id: DOC,
    title: '示例文档',
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: docState.lifecycle,
    byteSize: 12,
    indexVersion: 1,
    errorCode: null,
    embedReady: 1,
    esReady: 1,
    tenantId: TENANT,
    kbId: KB,
    sourceType: 'upload',
    contentType: 'text/plain',
    errorMessage: null,
    docType: 'policy',
    createdAt: '2026-08-01 10:00:00',
    updatedAt: '2026-08-02 11:00:00',
    ownerDeptId: docState.ownerDeptId,
    visibilityLevel: docState.visibilityLevel,
  };
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => (id === DOC && docState.exists ? mockRow() : null),
    patchMeta: async (
      _id: string,
      patch: { ownerDeptId?: string | null; visibilityLevel?: number },
    ) => {
      docState.patchCalls.push(patch);
      if (patch.ownerDeptId !== undefined) docState.ownerDeptId = patch.ownerDeptId;
      if (patch.visibilityLevel !== undefined) docState.visibilityLevel = patch.visibilityLevel;
    },
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles,
    tenantId: TENANT,
  });
  return pair.accessToken;
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

describe('PATCH /documents/:docId 部门元数据（P3b-META）', () => {
  afterEach(() => {
    docState.exists = true;
    docState.ownerDeptId = null;
    docState.visibilityLevel = 20;
    docState.lifecycle = 'active';
    docState.patchCalls = [];
  });

  it('非法 visibilityLevel → 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const accessToken = await token(['kb_admin']);
    for (const visibilityLevel of [41, 15]) {
      const res = await app.request(`/api/v1/documents/${DOC}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ visibilityLevel }),
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { ok: boolean; error: { code: string } };
      expect(body.ok).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    }
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('非 uuid ownerDeptId → 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const accessToken = await token(['kb_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ownerDeptId: 'not-a-uuid' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('空 body → 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const accessToken = await token(['kb_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('无 token → 401', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ visibilityLevel: 20 }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('无 doc.editor → 403 FORBIDDEN', async () => {
    const app = buildApp();
    const accessToken = await token(['web_consumer']);
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ visibilityLevel: 20 }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('doc.editor');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('文档不存在 → 404', async () => {
    docState.exists = false;
    const app = buildApp();
    const accessToken = await token(['kb_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ visibilityLevel: 30 }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('有 doc.editor 可写可回读，且不改 lifecycle', async () => {
    const app = buildApp();
    const accessToken = await token(['kb_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ownerDeptId: DEPT, visibilityLevel: 30 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { ownerDeptId: string | null; visibilityLevel: number; lifecycle: string };
    };
    expect(body.data.ownerDeptId).toBe(DEPT);
    expect(body.data.visibilityLevel).toBe(30);
    expect(body.data.lifecycle).toBe('active');
    expect(docState.patchCalls).toEqual([{ ownerDeptId: DEPT, visibilityLevel: 30 }]);
    expect(docState.lifecycle).toBe('active');
  });
});
