/**
 * 目标：doc_operator（有 doc.upload、无 approval.decide）上传 complete 必须 200 且只进待审，不得自动入队 scan。
 * 需求：剧本 Y2 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048 · ADR-051
 * 被测：POST /api/v1/knowledge-bases/:kbId/documents/:docId/complete · services/queue.js
 * 简介：AUTH_ENFORCE=true + doc_operator 令牌 + mock 仓：complete 200、approval_status=pending、enqueueIngest 零调用。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d6';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  approvalStatus: 'none' as string,
  status: 'uploaded',
  completes: [] as Array<{ id: string; approvalStatus: string; status: string }>,
};

const enqueueState = { calls: [] as Array<{ docId: string; stage: string }> };

/** 成员资格一律 true：本条测的是「有上传码者的审批后果」，不是成员闸 */
vi.mock('../../src/services/members.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/members.js')>();
  return {
    ...actual,
    membersRepo: { ...actual.membersRepo, isMember: async () => true },
  };
});

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
            byteSize: null,
            contentType: 'application/pdf',
            ownerDeptId: null,
            aclPrincipals: null,
          }
        : null,
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    markCompletePending: async (id: string) => {
      docState.approvalStatus = 'pending';
      docState.status = 'uploaded';
      docState.completes.push({ id, approvalStatus: 'pending', status: 'uploaded' });
    },
    patchMeta: async () => undefined,
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: 4_096 }),
    getObjectBuffer: async () => Buffer.alloc(4_096, 0x61),
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: { docId: string; stage: string }) => {
    enqueueState.calls.push({ docId: data.docId, stage: data.stage });
    return 'job-should-not-exist';
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');
const { createMemoryChunkStrategyCatalogRepo, setChunkStrategyCatalogRepoForTest } =
  await import('../../src/services/chunk-strategy-catalog.js');

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

async function docOperatorToken() {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles: ['doc_operator'],
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return pair.accessToken;
}

beforeEach(() => {
  docState.approvalStatus = 'none';
  docState.status = 'uploaded';
  docState.completes = [];
  enqueueState.calls = [];
  setChunkStrategyCatalogRepoForTest(
    createMemoryChunkStrategyCatalogRepo({
      kbId: KB,
      enabled: [
        {
          code: 'structure_paragraph',
          enabled: true,
          recommendedFamilies: ['md', 'txt', 'docx', 'pdf_text'],
        },
      ],
    }),
  );
});

afterEach(() => {
  setChunkStrategyCatalogRepoForTest(null);
  vi.unstubAllEnvs();
});

describe('剧本 Y2 · doc_operator complete 进 pending 不入队 scan', () => {
  it('enforce 开 + doc_operator：complete 200、pending、enqueueIngest 零调用', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const app = buildApp();

    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await docOperatorToken()}` },
      body: '{}',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { approvalStatus: string; status: string } };
    expect(body.data.approvalStatus).toBe('pending');
    expect(body.data.status).toBe('uploaded');
    expect(docState.completes).toEqual([
      { id: DOC, approvalStatus: 'pending', status: 'uploaded' },
    ]);
    expect(enqueueState.calls).toEqual([]);
  });

  it('对照：同一用户调审批仍 403（Y3）且不落审批', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const app = buildApp();
    const accessToken = await docOperatorToken();

    const res = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as { error: { message: string } }).error.message).toContain(
      'approval.decide',
    );
    expect(docState.approvalStatus).not.toBe('approved');
    expect(enqueueState.calls).toEqual([]);
  });
});
