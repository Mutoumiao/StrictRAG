/**
 * 目标：有 eval.run 才能维护黄金集；重复题号冲突；无库 404。
 * 需求：prds/05-api §2.8 · 功能表 §4.1
 * 被测：GET/POST/PATCH/DELETE /knowledge-bases/:kbId/gold-questions
 * 简介：运营题面落库；不是 fixtures/l1 CLI seed。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createEvalRoutes, type EvalRouteDeps } from '../../src/routes/eval.js';
import type { GoldQuestionRow, GoldRepo, GoldWrite } from '../../src/services/gold-questions.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

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
  const repo: GoldRepo & { rows: GoldQuestionRow[] } = {
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
        createdAt: '2026-08-29 12:00:00',
        updatedAt: '2026-08-29 12:00:00',
      };
      rows.push(row);
      return { ok: true, row };
    },
    async update({ id, kbId, data }) {
      const idx = rows.findIndex((r) => r.id === id && r.kbId === kbId);
      if (idx < 0) return { ok: false, reason: 'not_found' };
      const nextKey = data.caseKey ?? rows[idx].caseKey;
      if (
        data.caseKey &&
        rows.some((r, i) => i !== idx && r.kbId === kbId && r.caseKey === nextKey)
      ) {
        return { ok: false, reason: 'conflict' };
      }
      const cur = rows[idx];
      const patched: GoldQuestionRow = {
        ...cur,
        caseKey: data.caseKey ?? cur.caseKey,
        question: data.question ?? cur.question,
        type: data.type ?? cur.type,
        expectedDocIds:
          data.expectedDocIds === undefined ? cur.expectedDocIds : data.expectedDocIds,
        expectedChunkIds:
          data.expectedChunkIds === undefined ? cur.expectedChunkIds : data.expectedChunkIds,
        rubric: data.rubric === undefined ? cur.rubric : data.rubric,
      };
      rows[idx] = patched;
      return { ok: true, row: patched };
    },
    async remove({ id, kbId }) {
      const idx = rows.findIndex((r) => r.id === id && r.kbId === kbId);
      if (idx < 0) return false;
      rows.splice(idx, 1);
      return true;
    },
  };
  return repo;
}

function buildApp(opts: { members?: Set<string>; gold?: GoldRepo } = {}) {
  const members = opts.members ?? new Set<string>();
  const gold = opts.gold ?? memoryGold();
  const deps: EvalRouteDeps = {
    resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
    getKb: async (id) => (id === KB ? { id, tenantId: TENANT } : null),
    gold,
    enqueue: async () => 'job-1',
  };
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createEvalRoutes(deps));
  return { app, gold };
}

describe('gold-questions HTTP', () => {
  it('kb_admin 可创建并列出题目', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const { app } = buildApp({ members: new Set([userId]) });
    const created = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        caseKey: 'g1',
        question: '住宿标准？',
        type: 'answerable',
      }),
    });
    expect(created.status).toBe(201);
    const list = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { data: { items: Array<{ caseKey: string }> } };
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].caseKey).toBe('g1');
  });

  it('重复 caseKey 409；无码 403；无令牌 401；缺库 404', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const outsider = await token(['web_consumer']);
    const { app } = buildApp({ members: new Set([userId]) });
    const body = {
      caseKey: 'g1',
      question: 'q',
      type: 'unanswerable',
    };
    const first = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(first.status).toBe(201);
    const dup = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(dup.status).toBe(409);

    const forbidden = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions`, {
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(forbidden.status).toBe(403);

    const unauth = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions`);
    expect(unauth.status).toBe(401);

    const admin = await token(['super_admin']);
    const missing = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-0000000000ff/gold-questions',
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    expect(missing.status).toBe(404);
  });

  it('PATCH 改题面、DELETE 去掉题目', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const gold = memoryGold();
    const { app } = buildApp({ members: new Set([userId]), gold });
    await gold.create({
      tenantId: TENANT,
      kbId: KB,
      data: { caseKey: 'g2', question: '旧', type: 'answerable' } satisfies GoldWrite,
    });
    const id = gold.rows[0].id;
    const patched = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions/${id}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ question: '新题面' }),
    });
    expect(patched.status).toBe(200);
    const del = await app.request(`/api/v1/knowledge-bases/${KB}/gold-questions/${id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(del.status).toBe(200);
    expect(gold.rows).toHaveLength(0);
  });
});
