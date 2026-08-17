import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { createMemoryChunksRepo, type ChunkRow } from '../services/chunks.js';
import { createChunkRoutes } from './chunks.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';

const deptAcl = {
  enforce: false,
  assignments: [] as { deptId: string; isLeader: boolean }[],
};

vi.mock('../services/retrieve/dept-acl.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/retrieve/dept-acl.js')>();
  return {
    ...actual,
    isDeptAclEnforced: () => deptAcl.enforce,
    loadDeptAssignments: async () => deptAcl.assignments,
    loadDeptNodes: async () => [],
    loadDeptGrants: async () => [],
  };
});

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
        ownerDeptId: DEPT_B,
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
});
