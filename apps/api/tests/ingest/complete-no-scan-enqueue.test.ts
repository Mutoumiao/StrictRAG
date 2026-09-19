/**
 * 目标：complete 合法文件后只登记待审（approval_status=pending），不得入队任何 ingest.scan job。
 * 需求：剧本 V1 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048
 * 被测：POST /api/v1/knowledge-bases/:kbId/documents/:docId/complete · services/queue.js
 * 简介：mock 仓 + mock 队列记录器：complete 200 → enqueueIngest 零调用、markCompletePending 一次且为 pending；
 *       对照：显式 POST /scan 才入队（审批闸仍需 approved）。无真 Redis / 无真队列。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d7';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  approvalStatus: 'none' as string,
  status: 'uploaded',
  completes: [] as Array<{ id: string; approvalStatus: string; status: string }>,
};

const enqueueState = { calls: [] as Array<{ docId: string; stage: string }> };

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
    return 'job-should-only-exist-on-scan';
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

async function token() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['super_admin'],
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
});

describe('剧本 V1 · complete 不入队 scan', () => {
  it('complete 200 → pending，且 enqueueIngest 零调用', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
      body: '{}',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { approvalStatus: string; status: string } };
    expect(body.data.approvalStatus).toBe('pending');
    expect(body.data.status).toBe('uploaded');
    expect(docState.completes).toEqual([
      { id: DOC, approvalStatus: 'pending', status: 'uploaded' },
    ]);
    // V1 的关键：受理 complete 不等于入队扫描
    expect(enqueueState.calls).toEqual([]);
  });

  it('对照：显式 POST /scan 才入队，且未批仍被 403 挡住', async () => {
    const app = buildApp();
    const accessToken = await token();

    const denied = await app.request(`/api/v1/documents/${DOC}/scan`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(denied.status).toBe(403);
    expect(enqueueState.calls).toEqual([]);

    docState.approvalStatus = 'approved';
    const allowed = await app.request(`/api/v1/documents/${DOC}/scan`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(allowed.status).toBe(200);
    expect(enqueueState.calls).toEqual([{ docId: DOC, stage: 'scan' }]);
  });
});
