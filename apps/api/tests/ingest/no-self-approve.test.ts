/**
 * 目标：提交人不得批自己的单（四眼）；认不出 actor 或提交人时不得误伤运营台。
 * 需求：prds/09-security/01-auth-acl-compliance.md 禁自审默认（P2）· ADR-048 #4 · prds/10-delivery/03-acceptance-scenarios.md 剧本 V3
 * 被测：POST /api/v1/documents/:docId/approve · POST /api/v1/documents/:docId/reject
 * 简介：自审 403 且不写审批（approve 与 reject 同口径）；他人审批 200 并记审批人；无 actor 不误伤；提交人未知不拦；已通过幂等不改判。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000e1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const SUBMITTER = '01900000-0000-7000-8000-0000000000b1';
const OTHER = '01900000-0000-7000-8000-0000000000b2';

const docState = {
  approvalStatus: 'pending' as string,
  uploadedBy: SUBMITTER as string | null,
};

const approveCalls: Array<{ docId: string; actorUserId?: string | null }> = [];
const rejectCalls: string[] = [];

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
            uploadedBy: docState.uploadedBy,
            status: 'uploaded',
          }
        : null,
    approve: async (docId: string, actorUserId?: string | null) => {
      approveCalls.push({ docId, actorUserId });
      docState.approvalStatus = 'approved';
    },
    reject: async (docId: string) => {
      rejectCalls.push(docId);
      docState.approvalStatus = 'rejected';
    },
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function tokenFor(userId: string) {
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles: ['kb_admin'],
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

type ActionBody = {
  ok: boolean;
  error?: { code: string; details?: { reason?: string } };
  data?: { docId: string; approvalStatus: string };
};

describe('剧本 V3 · 提交者不可自审（四眼）', () => {
  afterEach(() => {
    docState.approvalStatus = 'pending';
    docState.uploadedBy = SUBMITTER;
    approveCalls.length = 0;
    rejectCalls.length = 0;
  });

  it('提交人 approve 自己的单 → 403 FORBIDDEN，且不写审批', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenFor(SUBMITTER)}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as ActionBody;
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('FORBIDDEN');
    expect(body.error?.details?.reason).toBe('self_approve_forbidden');
    expect(approveCalls).toHaveLength(0);
    expect(docState.approvalStatus).toBe('pending');
  });

  it('提交人 reject 自己的单 → 403，且不写驳回', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/reject`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenFor(SUBMITTER)}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as ActionBody;
    expect(body.error?.code).toBe('FORBIDDEN');
    expect(rejectCalls).toHaveLength(0);
    expect(docState.approvalStatus).toBe('pending');
  });

  it('另一人 approve → 200，且把审批人写进 approve', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenFor(OTHER)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as ActionBody;
    expect(body.data?.approvalStatus).toBe('approved');
    expect(approveCalls).toEqual([{ docId: DOC, actorUserId: OTHER }]);
  });

  it('无 actor（无 Bearer，AUTH_ENFORCE 关）→ 不拦且不编造审批人', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/approve`, { method: 'POST' });
    expect(res.status).toBe(200);
    expect(approveCalls).toEqual([{ docId: DOC, actorUserId: null }]);
  });

  it('提交人未知（历史文 uploadedBy=null）→ 不拦', async () => {
    docState.uploadedBy = null;
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenFor(SUBMITTER)}` },
    });
    expect(res.status).toBe(200);
    expect(approveCalls).toEqual([{ docId: DOC, actorUserId: SUBMITTER }]);
  });

  it('已 approved 再 approve 幂等 200，提交人也不改判', async () => {
    docState.approvalStatus = 'approved';
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/approve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await tokenFor(SUBMITTER)}` },
    });
    expect(res.status).toBe(200);
    expect(approveCalls).toHaveLength(0);
    expect(docState.approvalStatus).toBe('approved');
  });
});
