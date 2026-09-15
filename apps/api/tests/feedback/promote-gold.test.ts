/**
 * 目标：运营纳入黄金集必须写入 gold_questions；用户提交与缺审核码不得写题。
 * 需求：ADR-019 · prds/05-api §2.6 · 功能表 §4.1 · 覆盖 G3（运营表，不是 gold.yaml）
 * 被测：createFeedbackRoutes PATCH promoted_to_gold
 * 简介：审核闸 = 队列点纳入；不改 2×2、不入队 eval/runs。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { invalidateRoleCache, setRoleAuthzLoader } from '../../src/auth/role-hydrate.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createMemoryFeedbackRepo } from '../../src/services/feedback.js';
import type { GoldQuestionRow, GoldRepo } from '../../src/services/gold-questions.js';
import { createFeedbackRoutes } from '../../src/routes/feedback.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const REQ = 'req-promote-gold-1';

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

function memoryGold(): GoldRepo & { rows: GoldQuestionRow[] } {
  const rows: GoldQuestionRow[] = [];
  return {
    rows,
    async listByKb({ kbId, limit, offset }) {
      return rows.filter((r) => r.kbId === kbId).slice(offset, offset + limit);
    },
    async countByKb(kbId) {
      return rows.filter((r) => r.kbId === kbId).length;
    },
    async getById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async create({ tenantId, kbId, data }) {
      if (rows.some((r) => r.kbId === kbId && r.caseKey === data.caseKey)) {
        return { ok: false, reason: 'conflict' };
      }
      const row: GoldQuestionRow = {
        id: uuidv7(),
        kbId,
        tenantId,
        caseKey: data.caseKey,
        question: data.question,
        type: data.type,
        expectedDocIds: data.expectedDocIds ?? null,
        expectedChunkIds: data.expectedChunkIds ?? null,
        rubric: data.rubric ?? null,
        createdAt: '2026-09-15 12:00:00',
        updatedAt: '2026-09-15 12:00:00',
      };
      rows.push(row);
      return { ok: true, row };
    },
    async update() {
      return { ok: false, reason: 'not_found' };
    },
    async remove() {
      return false;
    },
  };
}

function buildApp(opts: {
  members?: Set<string>;
  repo?: ReturnType<typeof createMemoryFeedbackRepo>;
  gold?: GoldRepo & { rows: GoldQuestionRow[] };
  question?: { raw?: string; standalone?: string | null };
}) {
  const members = opts.members ?? new Set<string>();
  const repo = opts.repo ?? createMemoryFeedbackRepo();
  const gold = opts.gold ?? memoryGold();
  repo.seedTrace({
    requestId: REQ,
    kbId: KB,
    userId: 'any',
    tenantId: TENANT,
    rawQuestion: opts.question?.raw ?? '住宿标准？',
    standaloneQuestion: opts.question?.standalone ?? null,
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
      gold,
    }),
  );
  return { app, repo, gold };
}

async function postFeedback(
  app: Hono<{ Variables: AuthVariables }>,
  accessToken: string,
  body: Record<string, unknown> = { rating: 'down', category: 'missing_doc', comment: '缺制度' },
) {
  return app.request(`/api/v1/ask/${REQ}/feedback`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('feedback promote to gold', () => {
  beforeEach(() => {
    setRoleAuthzLoader(null);
    invalidateRoleCache();
  });

  afterEach(() => {
    setRoleAuthzLoader(null);
    invalidateRoleCache();
  });

  it('POST 不写黄金集', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app, gold } = buildApp({ members: new Set([userId]) });
    const res = await postFeedback(app, accessToken);
    expect(res.status).toBe(201);
    expect(gold.rows).toHaveLength(0);
  });

  it('晋升写入黄金集且改状态；题面用独立问句；comment 进 rubric', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const { app, gold } = buildApp({
      members: new Set([consumer.userId, admin.userId]),
      question: { raw: '那份呢', standalone: ' 差旅住宿标准是什么？ ' },
    });
    const created = await postFeedback(app, consumer.accessToken);
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const patched = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'promoted_to_gold', goldType: 'unanswerable' }),
    });
    expect(patched.status).toBe(200);
    const body = (await patched.json()) as { data: { status: string } };
    expect(body.data.status).toBe('promoted_to_gold');
    expect(gold.rows).toHaveLength(1);
    expect(gold.rows[0]?.caseKey).toBe(`fb-${fbId}`);
    expect(gold.rows[0]?.question).toBe('差旅住宿标准是什么？');
    expect(gold.rows[0]?.type).toBe('unanswerable');
    expect(gold.rows[0]?.rubric).toBe('缺制度');
    expect(gold.rows[0]?.expectedDocIds).toBeNull();
  });

  it('无 goldType → 400 且不写题', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const { app, gold } = buildApp({
      members: new Set([consumer.userId, admin.userId]),
    });
    const created = await postFeedback(app, consumer.accessToken);
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const patched = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'promoted_to_gold' }),
    });
    expect(patched.status).toBe(400);
    expect(gold.rows).toHaveLength(0);
  });

  it('无题面 → 400 且不写题', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const { app, gold } = buildApp({
      members: new Set([consumer.userId, admin.userId]),
      question: { raw: '  ', standalone: '' },
    });
    const created = await postFeedback(app, consumer.accessToken);
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const patched = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'promoted_to_gold', goldType: 'answerable' }),
    });
    expect(patched.status).toBe(400);
    expect(gold.rows).toHaveLength(0);
  });

  it('有 feedback.queue 无 eval.run → 403 且不写题', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    setRoleAuthzLoader(async (userId) => {
      if (userId !== admin.userId) return null;
      return {
        roles: ['kb_admin'],
        codes: ['admin.shell', 'kb.list', 'feedback.queue'],
      };
    });
    const { app, gold } = buildApp({
      members: new Set([consumer.userId, admin.userId]),
    });
    const created = await postFeedback(app, consumer.accessToken);
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;

    const patched = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'promoted_to_gold', goldType: 'unanswerable' }),
    });
    expect(patched.status).toBe(403);
    expect(gold.rows).toHaveLength(0);
  });

  it('重复晋升不插第二题', async () => {
    const consumer = await token(['web_consumer']);
    const admin = await token(['kb_admin']);
    const { app, gold } = buildApp({
      members: new Set([consumer.userId, admin.userId]),
    });
    const created = await postFeedback(app, consumer.accessToken);
    const fbId = ((await created.json()) as { data: { feedbackId: string } }).data.feedbackId;
    const headers = {
      authorization: `Bearer ${admin.accessToken}`,
      'content-type': 'application/json',
    };
    const body = JSON.stringify({ status: 'promoted_to_gold', goldType: 'unanswerable' });
    const first = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers,
      body,
    });
    const second = await app.request(`/api/v1/feedback/${fbId}`, {
      method: 'PATCH',
      headers,
      body,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(gold.rows).toHaveLength(1);
  });
});
