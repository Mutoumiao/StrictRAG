/**
 * 目标：文档 lifecycle 四态可写；上架仍须 status=ready。
 * 需求：功能表 §4.3 生命周期
 * 被测：PATCH /documents/:docId/lifecycle
 * 简介：不测生效区间、替代联动。
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

const docState = {
  exists: true,
  status: 'ready',
  lifecycle: 'draft',
  setCalls: [] as string[],
};

function mockRow() {
  return {
    id: DOC,
    title: '示例文档',
    status: docState.status,
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
    docType: null,
    createdAt: '2026-08-01 10:00:00',
    updatedAt: '2026-08-02 11:00:00',
    ownerDeptId: null,
    visibilityLevel: 20,
  };
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => (id === DOC && docState.exists ? mockRow() : null),
    setLifecycle: async (_id: string, lifecycle: string) => {
      docState.setCalls.push(lifecycle);
      docState.lifecycle = lifecycle;
    },
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['kb_admin'],
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

describe('PATCH /documents/:docId/lifecycle 四态', () => {
  afterEach(() => {
    docState.exists = true;
    docState.status = 'ready';
    docState.lifecycle = 'draft';
    docState.setCalls = [];
  });

  it('archived / superseded / draft 均可 200', async () => {
    const app = buildApp();
    const accessToken = await token();
    for (const lifecycle of ['archived', 'superseded', 'draft'] as const) {
      docState.lifecycle = 'active';
      const res = await app.request(`/api/v1/documents/${DOC}/lifecycle`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ lifecycle }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { lifecycle: string } };
      expect(body.data.lifecycle).toBe(lifecycle);
    }
  });

  it('active 且 status=ready → 200', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}/lifecycle`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lifecycle: 'active' }),
    });
    expect(res.status).toBe(200);
    expect(docState.setCalls).toEqual(['active']);
  });

  it('active 但未 ready → 409', async () => {
    docState.status = 'parsing';
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}/lifecycle`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lifecycle: 'active' }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CONFLICT');
    expect(docState.setCalls).toHaveLength(0);
  });
});
