/**
 * 目标：文档 aclPrincipals 必须可 PATCH 三态回读，且列表/详情/语料同滤。
 * 需求：P3b 文档 ACL · 覆盖 B2-4 / B2-1 最小
 * 被测：PATCH/GET /documents/:docId · GET /knowledge-bases/:kbId/documents · filterDocsForAclPrincipals
 * 简介：null 可读、[] 非超管不可读；名单内外分滤；bypass 200；retrieve 语料不含未授权文档。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { filterDocsForAclPrincipals } from '../../src/services/retrieve/doc-acl.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const USER_IN = '01900000-0000-7000-8000-0000000000e1';
const USER_OUT = '01900000-0000-7000-8000-0000000000e2';
const DOC_NULL = '01900000-0000-7000-8000-0000000000d1';
const DOC_EMPTY = '01900000-0000-7000-8000-0000000000d2';
const DOC_IN = '01900000-0000-7000-8000-0000000000d3';
const DOC_OUT = '01900000-0000-7000-8000-0000000000d4';
const DOC_PATCH = '01900000-0000-7000-8000-0000000000d5';

function listRow(id: string, aclPrincipals: string[] | null) {
  return {
    id,
    title: id,
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
    sourceType: 'upload',
    contentType: 'text/plain',
    errorMessage: null,
    docType: null,
    createdAt: '2026-08-01 10:00:00',
    updatedAt: '2026-08-02 11:00:00',
    ownerDeptId: null,
    visibilityLevel: 20,
    aclPrincipals,
  };
}

const store = {
  rows: [
    listRow(DOC_NULL, null),
    listRow(DOC_EMPTY, []),
    listRow(DOC_IN, [USER_IN]),
    listRow(DOC_OUT, [USER_OUT]),
    listRow(DOC_PATCH, null),
  ],
  patchCalls: [] as Array<{ aclPrincipals?: string[] | null }>,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => store.rows.find((r) => r.id === id) ?? null,
    listDocsByKb: async () => store.rows.filter((r) => r.id !== DOC_PATCH),
    getKb: async () => ({
      id: KB,
      tenantId: TENANT,
      configJson: {},
    }),
    patchMeta: async (_id: string, patch: { aclPrincipals?: string[] | null }) => {
      store.patchCalls.push(patch);
      const row = store.rows.find((r) => r.id === _id);
      if (row && patch.aclPrincipals !== undefined) {
        row.aclPrincipals = patch.aclPrincipals;
      }
    },
  },
}));

const { createDocumentRoutes } = await import('../../src/routes/documents/index.js');

async function token(userId: string, roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId,
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

describe('PATCH /documents/:docId aclPrincipals 三态', () => {
  afterEach(() => {
    store.patchCalls = [];
    const row = store.rows.find((r) => r.id === DOC_PATCH);
    if (row) row.aclPrincipals = null;
  });

  it('null / [] / uuid 列表可回读', async () => {
    const app = buildApp();
    const accessToken = await token(USER_IN);
    const cases: Array<string[] | null> = [null, [], [USER_IN]];
    for (const aclPrincipals of cases) {
      const res = await app.request(`/api/v1/documents/${DOC_PATCH}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ aclPrincipals }),
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as { data: { aclPrincipals: string[] | null } };
      expect(body.data.aclPrincipals).toEqual(aclPrincipals);
    }
    expect(store.patchCalls.map((p) => p.aclPrincipals)).toEqual([null, [], [USER_IN]]);
  });

  it('非法 uuid → 400 VALIDATION_ERROR', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC_PATCH}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${await token(USER_IN)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ aclPrincipals: ['not-a-uuid'] }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(store.patchCalls).toHaveLength(0);
  });
});

describe('GET 列表 / 详情 aclPrincipals', () => {
  it('显式 [] 对非超管不含该行；null 含该行；名单外不含、名单内含', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents`, {
      headers: { authorization: `Bearer ${await token(USER_IN)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ id: string }> };
    expect(body.data.map((d) => d.id)).toEqual([DOC_NULL, DOC_IN]);
  });

  it('GET 详情：名单外 403；bypass 200', async () => {
    const app = buildApp();
    const denied = await app.request(`/api/v1/documents/${DOC_OUT}`, {
      headers: { authorization: `Bearer ${await token(USER_IN)}` },
    });
    expect(denied.status).toBe(403);
    const deniedBody = (await denied.json()) as { error: { code: string; message: string } };
    expect(deniedBody.error.code).toBe('FORBIDDEN');
    expect(deniedBody.error.message).toContain('document acl denied');

    const allowed = await app.request(`/api/v1/documents/${DOC_OUT}`, {
      headers: { authorization: `Bearer ${await token(USER_IN, ['super_admin'])}` },
    });
    expect(allowed.status).toBe(200);
  });
});

describe('retrieve 语料 aclPrincipals（B2-1 最小）', () => {
  it('未授权文档不进过滤结果', () => {
    const corpus = [
      { id: DOC_NULL, aclPrincipals: null as string[] | null },
      { id: DOC_EMPTY, aclPrincipals: [] as string[] },
      { id: DOC_IN, aclPrincipals: [USER_IN] },
      { id: DOC_OUT, aclPrincipals: [USER_OUT] },
    ];
    expect(filterDocsForAclPrincipals(corpus, { userId: USER_IN }).map((d) => d.id)).toEqual([
      DOC_NULL,
      DOC_IN,
    ]);
  });
});
