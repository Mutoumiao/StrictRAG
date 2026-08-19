import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../auth/middleware.js';
import { requestIdMiddleware } from '../../middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DEPT = '01900000-0000-7000-8000-0000000000de';

const completeState = {
  dataClass: 'internal' as string | undefined,
  deptAclEnforce: undefined as boolean | undefined,
  ownerDeptId: null as string | null,
  markCalls: [] as Array<{ id: string; size: number }>,
};

vi.mock('../../services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: 'structure_paragraph',
            approvalStatus: 'none',
            status: 'uploaded',
            byteSize: null,
            ownerDeptId: completeState.ownerDeptId,
          }
        : null,
    getKb: async (id: string) =>
      id === KB
        ? {
            id: KB,
            tenantId: TENANT,
            configJson: {
              ...(completeState.dataClass === undefined
                ? {}
                : { dataClass: completeState.dataClass }),
              ...(completeState.deptAclEnforce === undefined
                ? {}
                : { deptAclEnforce: completeState.deptAclEnforce }),
            },
          }
        : null,
    markCompletePending: async (id: string, size: number) => {
      completeState.markCalls.push({ id, size });
    },
    patchMeta: async (
      _id: string,
      patch: { ownerDeptId?: string | null; visibilityLevel?: number },
    ) => {
      if (patch.ownerDeptId !== undefined) completeState.ownerDeptId = patch.ownerDeptId;
    },
  },
}));

vi.mock('../../services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: 12, contentType: 'text/plain' }),
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

const { documentRoutes } = await import('./index.js');

async function token(roles: string[] = ['super_admin']) {
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

async function postComplete(payload: Record<string, unknown> = {}) {
  const app = buildApp();
  const accessToken = await token();
  return app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
}

describe('P3b-SENS complete 敏感闸', () => {
  afterEach(() => {
    completeState.dataClass = 'internal';
    completeState.deptAclEnforce = undefined;
    completeState.ownerDeptId = null;
    completeState.markCalls = [];
    vi.unstubAllEnvs();
  });

  it('internal → 200 且 markComplete', async () => {
    completeState.dataClass = 'internal';
    const res = await postComplete();
    expect(res.status).toBe(200);
    expect(completeState.markCalls).toEqual([{ id: DOC, size: 12 }]);
  });

  it('sensitive + 无 enforce → 400 RULE_VIOLATION，不 markComplete', async () => {
    completeState.dataClass = 'sensitive';
    vi.stubEnv('DEPT_ACL_ENFORCE', 'false');
    const res = await postComplete();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RULE_VIOLATION');
    expect(completeState.markCalls).toHaveLength(0);
  });

  it('sensitive + enforce true + 无 ownerDeptId → 400 RULE_VIOLATION', async () => {
    completeState.dataClass = 'sensitive';
    completeState.ownerDeptId = null;
    vi.stubEnv('DEPT_ACL_ENFORCE', 'true');
    const res = await postComplete();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RULE_VIOLATION');
    expect(completeState.markCalls).toHaveLength(0);
  });

  it('sensitive + enforce true + ownerDeptId → 放行本闸并 markComplete', async () => {
    completeState.dataClass = 'sensitive';
    completeState.ownerDeptId = DEPT;
    vi.stubEnv('DEPT_ACL_ENFORCE', 'true');
    const res = await postComplete();
    expect(res.status).toBe(200);
    expect(completeState.markCalls).toEqual([{ id: DOC, size: 12 }]);
  });

  it('sensitive + enforce + complete 同请求带 ownerDeptId → 200 且 markComplete', async () => {
    completeState.dataClass = 'sensitive';
    completeState.ownerDeptId = null;
    vi.stubEnv('DEPT_ACL_ENFORCE', 'true');
    const res = await postComplete({ ownerDeptId: DEPT });
    expect(res.status).toBe(200);
    expect(completeState.ownerDeptId).toBe(DEPT);
    expect(completeState.markCalls).toEqual([{ id: DOC, size: 12 }]);
  });

  it('sensitive + enforce + 库上已有部门 + complete 显式 null → 仍 400', async () => {
    completeState.dataClass = 'sensitive';
    completeState.ownerDeptId = DEPT;
    vi.stubEnv('DEPT_ACL_ENFORCE', 'true');
    const res = await postComplete({ ownerDeptId: null });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RULE_VIOLATION');
    expect(completeState.ownerDeptId).toBeNull();
    expect(completeState.markCalls).toHaveLength(0);
  });

  it('sensitive + env false + KB true + owner → 放行本闸', async () => {
    completeState.dataClass = 'sensitive';
    completeState.deptAclEnforce = true;
    completeState.ownerDeptId = DEPT;
    vi.stubEnv('DEPT_ACL_ENFORCE', 'false');
    const res = await postComplete();
    expect(res.status).toBe(200);
    expect(completeState.markCalls).toEqual([{ id: DOC, size: 12 }]);
  });

  it('sensitive + env false + KB true + 无 owner → 仍挡', async () => {
    completeState.dataClass = 'sensitive';
    completeState.deptAclEnforce = true;
    completeState.ownerDeptId = null;
    vi.stubEnv('DEPT_ACL_ENFORCE', 'false');
    const res = await postComplete();
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RULE_VIOLATION');
    expect(completeState.markCalls).toHaveLength(0);
  });

  it('非法 ownerDeptId → 400，不 markComplete', async () => {
    const res = await postComplete({ ownerDeptId: 'not-a-uuid' });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(completeState.markCalls).toHaveLength(0);
  });
});
