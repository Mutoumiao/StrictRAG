/**
 * 目标：答案反馈 POST/PATCH 必须具备 kb 码。
 * 需求：B13
 * 被测：createFeedbackRoutes
 * 简介：须 kb 码。
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { metricGet, metricsReset } from '../../src/obs/index.js';
import { createMemoryFeedbackRepo } from '../../src/services/feedback.js';
import { createFeedbackRoutes } from '../../src/routes/feedback.js';
import {
  baseInput,
  deps as graphDeps,
  happyChat,
  runAskGraph,
} from '../ask/_support/graph-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const REQ = 'req-feedback-1';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: roles.includes('web_consumer') && !roles.includes('kb_admin') ? 'web' : 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp(opts: {
  members?: Set<string>;
  repo?: ReturnType<typeof createMemoryFeedbackRepo>;
}) {
  const members = opts.members ?? new Set<string>();
  const repo = opts.repo ?? createMemoryFeedbackRepo();
  repo.seedTrace({
    requestId: REQ,
    kbId: KB,
    userId: 'any',
    tenantId: TENANT,
  });

  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createFeedbackRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      feedback: repo,
      getTrace: async (requestId) => repo.getTrace(requestId),
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
    }),
  );
  return { app, repo };
}

describe('feedback API', () => {
  beforeEach(() => {
    metricsReset();
  });

  it('成员可提交 feedback', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set([userId]) });

    const res = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down', category: 'wrong_answer', comment: '不对' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { feedbackId: string; status: string; requestId: string };
    };
    expect(body.data.status).toBe('open');
    expect(body.data.requestId).toBe(REQ);
    expect(body.data.feedbackId).toBeTruthy();
  });

  it('空 body → 400', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('非成员提交 → 403', async () => {
    const { accessToken } = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'up' }),
    });
    expect(res.status).toBe(403);
  });

  it('未知 requestId → 404', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/ask/missing-req/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'up' }),
    });
    expect(res.status).toBe(404);
  });

  it('kb_admin 可列队列并标记处理；web_consumer 列队列 403', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const members = new Set([consumer.userId, admin.userId]);
    const { app, repo } = buildApp({ members });

    const created = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${consumer.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down', category: 'missing_doc' }),
    });
    expect(created.status).toBe(201);
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const denied = await app.request(`/api/v1/knowledge-bases/${KB}/feedback-queue`, {
      headers: { authorization: `Bearer ${consumer.accessToken}` },
    });
    expect(denied.status).toBe(403);

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/feedback-queue`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: { items: { feedbackId: string }[] } };
    expect(listBody.data.items.some((i) => i.feedbackId === fbId)).toBe(true);

    const patched = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    expect(patched.status).toBe(200);
    const pBody = (await patched.json()) as {
      data: { status: string; handlerId: string };
    };
    expect(pBody.data.status).toBe('dismissed');
    expect(pBody.data.handlerId).toBe(admin.userId);

    const openOnly = await app.request(
      `/api/v1/knowledge-bases/${KB}/feedback-queue?status=open`,
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    const openBody = (await openOnly.json()) as { data: { items: unknown[] } };
    expect(openBody.data.items).toHaveLength(0);

    void repo;
  });

  it('无 feedback.queue 不可 PATCH', async () => {
    const consumer = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set([consumer.userId]) });
    const created = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${consumer.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'up' }),
    });
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const res = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${consumer.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'dismissed' }),
    });
    expect(res.status).toBe(403);
  });

  it('down + 非空 sessionId → 201 且 l3_topic_complaint_total=1', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app, repo } = buildApp({ members: new Set([userId]) });
    const requestId = 'req-l3f-down-session';
    repo.seedTrace({
      requestId,
      kbId: KB,
      userId: 'any',
      tenantId: TENANT,
      sessionId: uuidv7(),
    });

    const res = await app.request(`/api/v1/ask/${requestId}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down' }),
    });
    expect(res.status).toBe(201);
    expect(metricGet('l3_topic_complaint_total')).toBe(1);
  });

  it('down 无 session → 201 且计数不加', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set([userId]) });

    const res = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down' }),
    });
    expect(res.status).toBe(201);
    expect(metricGet('l3_topic_complaint_total')).toBe(0);
  });

  it('up + 有 session → 201 且计数不加', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app, repo } = buildApp({ members: new Set([userId]) });
    const requestId = 'req-l3f-up-session';
    repo.seedTrace({
      requestId,
      kbId: KB,
      userId: 'any',
      tenantId: TENANT,
      sessionId: uuidv7(),
    });

    const res = await app.request(`/api/v1/ask/${requestId}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'up' }),
    });
    expect(res.status).toBe(201);
    expect(metricGet('l3_topic_complaint_total')).toBe(0);
  });
});

describe('剧本 G1 / G2 / S3 · 反馈闭环', () => {
  beforeEach(() => {
    metricsReset();
  });

  it('G1：abstained 轮提交 missing_doc → 201 status=open，运营队列可见', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const members = new Set([consumer.userId, admin.userId]);
    const { app, repo } = buildApp({ members });

    // 真跑一轮拒答：同一 requestId 的轮次状态 = abstained（无证据 → low_retrieval）
    const round = await runAskGraph(
      baseInput({ requestId: 'req-g1-abstained', question: '库外问题：公司年会抽奖名单？' }),
      graphDeps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'low_retrieval' }),
      }),
    );
    expect(round.status).toBe('abstained');
    repo.seedTrace({
      requestId: 'req-g1-abstained',
      kbId: KB,
      userId: consumer.userId,
      tenantId: TENANT,
    });

    const res = await app.request('/api/v1/ask/req-g1-abstained/feedback', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${consumer.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down', category: 'missing_doc', comment: '缺制度' }),
    });
    expect(res.status).toBe(201);
    const created = (await res.json()) as {
      data: { feedbackId: string; status: string; category: string; handlerId: string | null };
    };
    expect(created.data.status).toBe('open');
    expect(created.data.category).toBe('missing_doc');
    expect(created.data.handlerId).toBeNull();

    const queue = await app.request(`/api/v1/knowledge-bases/${KB}/feedback-queue?status=open`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    expect(queue.status).toBe(200);
    const listed = (await queue.json()) as { data: { items: { feedbackId: string }[] } };
    expect(listed.data.items.some((i) => i.feedbackId === created.data.feedbackId)).toBe(true);
  });

  it('G2：运营以 linked_doc 关单 → 200 且记解析时间；队列可按该状态过滤', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const members = new Set([consumer.userId, admin.userId]);
    const { app } = buildApp({ members });

    const created = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${consumer.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down', category: 'missing_doc', comment: '缺文档' }),
    });
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const closed = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'linked_doc' }),
    });
    expect(closed.status).toBe(200);
    const closedBody = (await closed.json()) as {
      data: { status: string; resolvedAt: string | null; handlerId: string | null };
    };
    expect(closedBody.data.status).toBe('linked_doc');
    expect(closedBody.data.resolvedAt).toBeTruthy();
    expect(closedBody.data.handlerId).toBe(admin.userId);

    const stillOpen = await app.request(
      `/api/v1/knowledge-bases/${KB}/feedback-queue?status=open`,
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    const openItems = (await stillOpen.json()) as { data: { items: unknown[] } };
    expect(openItems.data.items).toHaveLength(0);

    const linked = await app.request(
      `/api/v1/knowledge-bases/${KB}/feedback-queue?status=linked_doc`,
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    const linkedItems = (await linked.json()) as { data: { items: { feedbackId: string }[] } };
    expect(linkedItems.data.items.map((i) => i.feedbackId)).toContain(fbId);
  });

  it('S3：read 用户（web_consumer）提交反馈可达，且运营队列能读到该单', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const { app } = buildApp({ members: new Set([consumer.userId, admin.userId]) });

    const res = await app.request(`/api/v1/ask/${REQ}/feedback`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${consumer.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ rating: 'down', category: 'missing_doc' }),
    });
    expect(res.status).toBe(201);
    const fbId = ((await res.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const queue = await app.request(`/api/v1/knowledge-bases/${KB}/feedback-queue`, {
      headers: { authorization: `Bearer ${admin.accessToken}` },
    });
    expect(queue.status).toBe(200);
    const items = (await queue.json()) as { data: { items: { feedbackId: string }[] } };
    expect(items.data.items.some((i) => i.feedbackId === fbId)).toBe(true);
  });
});
