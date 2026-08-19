import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { createMemoryChunksRepo, type ChunkRow } from '../services/chunks.js';
import { createChunkRoutes } from './chunks.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';

const deptAcl = {
  enforce: false,
  assignments: [] as { deptId: string; isLeader: boolean }[],
  depts: [] as { id: string; path: string }[],
  grants: [] as { deptId: string; maxVisibilityLevel: number; expiresAt?: string | null }[],
  kbConfig: {} as Record<string, unknown>,
  ownerDeptId: DEPT_B as string | null,
};

vi.mock('../services/retrieve/dept-acl.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/retrieve/dept-acl.js')>();
  return {
    ...actual,
    isDeptAclEnforced: () => deptAcl.enforce,
    loadDeptAssignments: async () => deptAcl.assignments,
    loadDeptNodes: async () => deptAcl.depts,
    loadDeptGrants: async () => deptAcl.grants,
  };
});

vi.mock('../services/documents.js', () => ({
  documentRepo: {
    getKb: async () => ({
      id: KB,
      tenantId: TENANT,
      configJson: deptAcl.kbConfig,
    }),
  },
}));

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles,
    email: `${uuidv7().slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return pair.accessToken;
}

function buildApp() {
  const repo = createMemoryChunksRepo({
    docs: [
      {
        id: DOC,
        indexVersion: 2,
        status: 'ready',
        lifecycle: 'active',
        tenantId: TENANT,
        kbId: KB,
        ownerDeptId: deptAcl.ownerDeptId,
        visibilityLevel: 20,
      },
    ],
    chunks: [
      {
        id: '01900000-0000-7000-8000-0000000000c1',
        docId: DOC,
        indexVersion: 2,
        ordinal: 0,
        preview: 'p',
        bodyText: 'body',
        tokenCount: 1,
      } satisfies ChunkRow,
    ],
  });
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createChunkRoutes({ chunks: repo }));
  return app;
}

describe('GET /documents/:docId/chunks 部门过滤（P3b-DEPT）', () => {
  afterEach(() => {
    deptAcl.enforce = false;
    deptAcl.assignments = [];
    deptAcl.depts = [];
    deptAcl.grants = [];
    deptAcl.kbConfig = {};
    deptAcl.ownerDeptId = DEPT_B;
  });

  it('关强制 → 200', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(200);
  });

  it('开 + 跨部门 → 403', async () => {
    deptAcl.enforce = true;
    deptAcl.assignments = [{ deptId: DEPT_A, isLeader: false }];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('enforce + 祖先 + KB false → 子孙 403，精确仍 200', async () => {
    deptAcl.enforce = true;
    deptAcl.assignments = [{ deptId: DEPT_A, isLeader: false }];
    deptAcl.depts = [
      { id: DEPT_A, path: `/${DEPT_A}/` },
      { id: DEPT_B, path: `/${DEPT_A}/${DEPT_B}/` },
    ];
    deptAcl.kbConfig = { deptInheritDown: false };
    deptAcl.ownerDeptId = DEPT_B;
    const denied = await buildApp().request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(denied.status).toBe(403);

    deptAcl.ownerDeptId = DEPT_A;
    const allowed = await buildApp().request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(allowed.status).toBe(200);
  });

  it('env false + KB deptAclEnforce true + 跨部门 → 403', async () => {
    deptAcl.enforce = false;
    deptAcl.kbConfig = { deptAclEnforce: true };
    deptAcl.assignments = [{ deptId: DEPT_A, isLeader: false }];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('开 + super_admin 跨部门 → 200', async () => {
    deptAcl.enforce = true;
    deptAcl.assignments = [];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${await token(['super_admin'])}` },
    });
    expect(res.status).toBe(200);
  });
});
