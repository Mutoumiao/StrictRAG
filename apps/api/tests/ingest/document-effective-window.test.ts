/**
 * 目标：文档生效区间 PATCH 必须可写可回读，乱序与非法格式须 400。
 * 需求：功能表 §4.3 / §5.4
 * 被测：PATCH /documents/:docId effectiveFrom/effectiveTo
 * 简介：不改 lifecycle；检索真值在 corpus。
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
  lifecycle: 'active',
  effectiveFrom: null as string | null,
  effectiveTo: null as string | null,
  patchCalls: [] as Array<{ effectiveFrom?: string | null; effectiveTo?: string | null }>,
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
    ownerDeptId: null,
    visibilityLevel: 20,
    effectiveFrom: docState.effectiveFrom,
    effectiveTo: docState.effectiveTo,
  };
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => (id === DOC && docState.exists ? mockRow() : null),
    patchMeta: async (
      _id: string,
      patch: { effectiveFrom?: string | null; effectiveTo?: string | null },
    ) => {
      docState.patchCalls.push(patch);
      if (patch.effectiveFrom !== undefined) docState.effectiveFrom = patch.effectiveFrom;
      if (patch.effectiveTo !== undefined) docState.effectiveTo = patch.effectiveTo;
    },
  },
}));

const { createDocumentRoutes } = await import('../../src/routes/documents/index.js');

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles,
    tenantId: TENANT,
  });
  return pair.accessToken;
}

// 成员闸桩：本文件主题不是成员资格，统一放行；闸本身由 doc-write-kb-member-gate.test.ts 覆盖
const resolveKbMember = async () => true;

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDocumentRoutes({ resolveKbMember }));
  return app;
}

describe('PATCH /documents/:docId 生效区间', () => {
  afterEach(() => {
    docState.exists = true;
    docState.lifecycle = 'active';
    docState.effectiveFrom = null;
    docState.effectiveTo = null;
    docState.patchCalls = [];
  });

  it('合法窗口写入并回读，不改 lifecycle', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        effectiveFrom: '2026-09-01 00:00:00',
        effectiveTo: '2026-09-30 00:00:00',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { effectiveFrom: string | null; effectiveTo: string | null; lifecycle: string };
    };
    expect(body.data.effectiveFrom).toBe('2026-09-01 00:00:00');
    expect(body.data.effectiveTo).toBe('2026-09-30 00:00:00');
    expect(body.data.lifecycle).toBe('active');
    expect(docState.patchCalls).toEqual([
      { effectiveFrom: '2026-09-01 00:00:00', effectiveTo: '2026-09-30 00:00:00' },
    ]);
  });

  it('from > to → 400，不写库', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        effectiveFrom: '2026-10-01 00:00:00',
        effectiveTo: '2026-09-01 00:00:00',
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('非法时间串 → 400', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ effectiveFrom: '2026-09-01T00:00:00Z' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('null 清除已有 from', async () => {
    docState.effectiveFrom = '2026-09-01 00:00:00';
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ effectiveFrom: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { effectiveFrom: string | null } };
    expect(body.data.effectiveFrom).toBeNull();
  });
});
