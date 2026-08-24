/**
 * 目标：admin 驳回后不得入队 scan；无独立重提则不得假装可重提。
 * 需求：剧本 V5 · prds/10-delivery/03-acceptance-scenarios.md · ADR-048
 * 被测：POST /api/v1/documents/:docId/reject · POST …/scan
 * 简介：pending→rejected 200；随后 scan 403 且不调用 enqueueIngest。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d5';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  approvalStatus: 'pending' as string,
  rejectCalls: 0,
};

const enqueueState = {
  calls: [] as Array<{ docId: string; stage: string }>,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: 'structure_paragraph',
            approvalStatus: docState.approvalStatus,
            status: 'uploaded',
            byteSize: 12,
          }
        : null,
    reject: async () => {
      docState.rejectCalls += 1;
      docState.approvalStatus = 'rejected';
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: { docId: string; stage: string }) => {
    enqueueState.calls.push({ docId: data.docId, stage: data.stage });
    return 'job-scan-should-not-fire';
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

describe('剧本 V5 · admin reject 后禁 scan', () => {
  afterEach(() => {
    docState.approvalStatus = 'pending';
    docState.rejectCalls = 0;
    enqueueState.calls = [];
  });

  it('pending reject → 200 approvalStatus=rejected', async () => {
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/reject`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { docId: string; approvalStatus: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.docId).toBe(DOC);
    expect(body.data.approvalStatus).toBe('rejected');
    expect(docState.approvalStatus).toBe('rejected');
    expect(docState.rejectCalls).toBe(1);
    expect(enqueueState.calls).toHaveLength(0);
  });

  it('驳回后 POST scan → 403，且 enqueueIngest 不被调用', async () => {
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const rejectRes = await app.request(`/api/v1/documents/${DOC}/reject`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(rejectRes.status).toBe(200);

    const scanRes = await app.request(`/api/v1/documents/${DOC}/scan`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(scanRes.status).toBe(403);
    const body = (await scanRes.json()) as {
      ok: boolean;
      error: { code: string; details?: { approvalStatus?: string } };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.details?.approvalStatus).toBe('rejected');
    expect(enqueueState.calls).toHaveLength(0);
  });
});
