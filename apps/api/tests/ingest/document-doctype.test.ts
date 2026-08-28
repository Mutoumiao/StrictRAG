/**
 * 目标：文档类型 PATCH 必须属于该 KB 已有枚举，非法码须 400。
 * 需求：功能表 §4.3 文档类型标注
 * 被测：PATCH /documents/:docId docType
 * 简介：不重做类型分区 CRUD；不测 ask scope。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { assertDocTypeAllowed } from '../../src/services/kb-settings.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  exists: true,
  docType: 'policy' as string | null,
  config: { docTypes: ['hr', 'policy'] } as Record<string, unknown>,
  patchCalls: [] as Array<{ docType?: string | null }>,
};

function mockRow() {
  return {
    id: DOC,
    title: '示例文档',
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'draft',
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
    docType: docState.docType,
    createdAt: '2026-08-01 10:00:00',
    updatedAt: '2026-08-02 11:00:00',
    ownerDeptId: null,
    visibilityLevel: 20,
  };
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => (id === DOC && docState.exists ? mockRow() : null),
    getKb: async (id: string) =>
      id === KB ? { id: KB, tenantId: TENANT, name: 'kb', configJson: docState.config } : null,
    patchMeta: async (_id: string, patch: { docType?: string | null }) => {
      docState.patchCalls.push(patch);
      if (patch.docType !== undefined) docState.docType = patch.docType;
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

describe('assertDocTypeAllowed', () => {
  it('null 可清除', () => {
    expect(assertDocTypeAllowed(['hr'], null).ok).toBe(true);
  });

  it('命中枚举通过', () => {
    expect(assertDocTypeAllowed(['hr', 'policy'], 'hr').ok).toBe(true);
  });

  it('不在枚举 → 失败', () => {
    const r = assertDocTypeAllowed(['hr'], 'legal');
    expect(r.ok).toBe(false);
  });

  it('空枚举不可写非空码', () => {
    const r = assertDocTypeAllowed([], 'hr');
    expect(r.ok).toBe(false);
  });
});

describe('PATCH /documents/:docId docType', () => {
  afterEach(() => {
    docState.exists = true;
    docState.docType = 'policy';
    docState.config = { docTypes: ['hr', 'policy'] };
    docState.patchCalls = [];
  });

  it('非法码 → 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ docType: 'legal' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('docType');
    expect(docState.patchCalls).toHaveLength(0);
  });

  it('属于枚举 → 200 并回读', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ docType: 'hr' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { docType: string | null } };
    expect(body.data.docType).toBe('hr');
    expect(docState.patchCalls).toEqual([{ docType: 'hr' }]);
  });

  it('null 可清除分类', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ docType: null }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { docType: string | null } };
    expect(body.data.docType).toBeNull();
  });
});
