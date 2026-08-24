/**
 * 目标：kb_admin 审批通过后必须可 scan 入队，禁止仍停在 pending。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 Y4
 * 被测：POST /documents/:docId/approve · POST /documents/:docId/scan
 * 简介：kb_admin 对 pending 文档 approve 200 后 scan 200，且 enqueueIngest stage=scan。
 * AUTH_ENFORCE 保持仓库默认关；不测禁自审（V3 缺实现）。
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
  approvalStatus: 'pending' as string,
};

const enqueueIngest = vi.hoisted(() =>
  vi.fn(async () => 'job-scan-1'),
);

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            objectKey: `kb/${KB}/${DOC}`,
            approvalStatus: docState.approvalStatus,
            status: 'uploaded',
          }
        : null,
    approve: async (_id: string) => {
      docState.approvalStatus = 'approved';
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest,
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

describe('Y4 kb_admin approve then scan', () => {
  afterEach(() => {
    docState.approvalStatus = 'pending';
    enqueueIngest.mockClear();
  });

  it('kb_admin 审批通过 → 200；随后 scan 200 且入队 stage=scan', async () => {
    const app = buildApp();
    const accessToken = await token(['kb_admin']);
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    const approve = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(approve.status).toBe(200);
    const approveBody = (await approve.json()) as {
      ok: boolean;
      data: { docId: string; approvalStatus: string };
    };
    expect(approveBody.ok).toBe(true);
    expect(approveBody.data.docId).toBe(DOC);
    expect(approveBody.data.approvalStatus).toBe('approved');
    expect(docState.approvalStatus).toBe('approved');

    const scan = await app.request(`/api/v1/documents/${DOC}/scan`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    });
    expect(scan.status).toBe(200);
    const scanBody = (await scan.json()) as {
      ok: boolean;
      data: { docId: string; enqueued: boolean; jobId: string; stage: string };
    };
    expect(scanBody.ok).toBe(true);
    expect(scanBody.data.docId).toBe(DOC);
    expect(scanBody.data.enqueued).toBe(true);
    expect(scanBody.data.stage).toBe('scan');
    expect(scanBody.data.jobId).toBe('job-scan-1');
    expect(enqueueIngest).toHaveBeenCalledTimes(1);
    expect(enqueueIngest).toHaveBeenCalledWith({
      docId: DOC,
      kbId: KB,
      tenantId: TENANT,
      stage: 'scan',
    });
  });
});
