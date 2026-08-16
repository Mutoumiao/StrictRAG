import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../auth/middleware.js';
import { requestIdMiddleware } from '../../middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';

const deptAcl = {
  enforce: false,
  assignments: [] as { deptId: string; isLeader: boolean }[],
  ownerDeptId: DEPT_B as string | null,
};

vi.mock('../../services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            title: '示例',
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
            ownerDeptId: deptAcl.ownerDeptId,
            visibilityLevel: 20,
          }
        : null,
  },
}));

vi.mock('../../services/retrieve/dept-acl.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/retrieve/dept-acl.js')>();
  return {
    ...actual,
    isDeptAclEnforced: () => deptAcl.enforce,
    loadDeptAssignments: async () => deptAcl.assignments,
  };
});

const { documentRoutes } = await import('./index.js');

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

describe('GET /documents/:docId 部门过滤（P3b-DEPT）', () => {
  afterEach(() => {
    deptAcl.enforce = false;
    deptAcl.assignments = [];
    deptAcl.ownerDeptId = DEPT_B;
  });

  it('关强制 → 跨部门仍 200', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(200);
  });

  it('开 + 部门不同 → 403', async () => {
    deptAcl.enforce = true;
    deptAcl.assignments = [{ deptId: DEPT_A, isLeader: false }];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('开 + 精确同部门 → 200', async () => {
    deptAcl.enforce = true;
    deptAcl.ownerDeptId = DEPT_A;
    deptAcl.assignments = [{ deptId: DEPT_A, isLeader: false }];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(200);
  });

  it('开 + owner_dept 空 + 无归属 → 200', async () => {
    deptAcl.enforce = true;
    deptAcl.ownerDeptId = null;
    deptAcl.assignments = [];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(200);
  });

  it('开 + 有主部门 + 无归属 → 403 非 5xx', async () => {
    deptAcl.enforce = true;
    deptAcl.ownerDeptId = DEPT_B;
    deptAcl.assignments = [];
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      headers: { authorization: `Bearer ${await token()}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });
});
