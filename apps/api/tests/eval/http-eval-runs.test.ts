/**
 * 目标：POST eval/runs 只入队；空题集拒绝；GET 回读 2×2；内口 skipTrace 靠口令。
 * 需求：prds/05-api §2.8 · 功能表 §5.2 · prds/06-async eval.run
 * 被测：POST/GET …/eval/runs · POST /internal/eval/execute-ask
 * 简介：请求线程不跑 L1；worker 消费。内口不是公开 ask。
 */

import type { EvalJobData } from '@strict-rag/contracts';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createEvalRoutes, type EvalRouteDeps } from '../../src/routes/eval.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';
import type { EvalRunRepo, EvalRunRow } from '../../src/services/eval-runs.js';
import type { GoldQuestionRow, GoldRepo } from '../../src/services/gold-questions.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function memoryGold(seed: GoldQuestionRow[] = []): GoldRepo {
  const rows = [...seed];
  return {
    async listByKb({ kbId }) {
      return rows.filter((r) => r.kbId === kbId);
    },
    async countByKb(kbId) {
      return rows.filter((r) => r.kbId === kbId).length;
    },
    async getById(id) {
      return rows.find((r) => r.id === id) ?? null;
    },
    async create() {
      throw new Error('not used');
    },
    async update() {
      throw new Error('not used');
    },
    async remove() {
      return false;
    },
  };
}

function memoryRuns(): EvalRunRepo & { rows: EvalRunRow[]; jobs: EvalJobData[] } {
  const rows: EvalRunRow[] = [];
  const jobs: EvalJobData[] = [];
  return {
    rows,
    jobs,
    async createQueued({ tenantId, kbId, retrieveMode, notes }) {
      const row: EvalRunRow = {
        id: uuidv7(),
        kbId,
        tenantId,
        status: 'queued',
        runType: 'golden_2x2',
        retrieveMode,
        signoffEligible: false,
        caseCount: 0,
        matrix: { A: 0, B: 0, C: 0, D: 0 },
        coverage: null,
        errorCount: 0,
        ranAt: '2026-08-29 12:00:00',
        jobId: null,
        errorMessage: null,
        notes: notes ?? null,
      };
      rows.push(row);
      return row;
    },
    async setJobId(runId, jobId) {
      const row = rows.find((r) => r.id === runId);
      if (row) row.jobId = jobId;
    },
    async getByKbAndId(kbId, runId) {
      return rows.find((r) => r.id === runId && r.kbId === kbId) ?? null;
    },
    async listByKb({ kbId }) {
      return rows.filter((r) => r.kbId === kbId);
    },
  };
}

function buildApp(opts: EvalRouteDeps & { members?: Set<string> }) {
  const members = opts.members ?? new Set<string>();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createEvalRoutes({
      ...opts,
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) => (id === KB ? { id, tenantId: TENANT } : null),
    }),
  );
  return app;
}

describe('eval runs HTTP', () => {
  it('无黄金题 POST 400；有题则入队并回 queued', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const empty = memoryRuns();
    const appEmpty = buildApp({
      members: new Set([userId]),
      gold: memoryGold(),
      evalRuns: empty,
      enqueue: async () => 'job-x',
    });
    const noGold = await appEmpty.request(`/api/v1/knowledge-bases/${KB}/eval/runs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(noGold.status).toBe(400);

    const runs = memoryRuns();
    const enqueued: EvalJobData[] = [];
    const app = buildApp({
      members: new Set([userId]),
      gold: memoryGold([
        {
          id: uuidv7(),
          kbId: KB,
          tenantId: TENANT,
          caseKey: 'g1',
          question: 'q',
          type: 'answerable',
          expectedDocIds: null,
          expectedChunkIds: null,
          rubric: null,
          createdAt: null,
          updatedAt: null,
        },
      ]),
      evalRuns: runs,
      enqueue: async (data) => {
        enqueued.push(data);
        return 'job-eval-1';
      },
      retrieveEsMode: () => 'mock',
    });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/eval/runs`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { runId: string; jobId: string; status: string };
    };
    expect(body.data.status).toBe('queued');
    expect(body.data.jobId).toBe('job-eval-1');
    expect(enqueued).toHaveLength(1);
    expect(enqueued[0].kbId).toBe(KB);
    expect(enqueued[0].retrieveMode).toBe('mock');

    const got = await app.request(
      `/api/v1/knowledge-bases/${KB}/eval/runs/${body.data.runId}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(got.status).toBe(200);
    const runBody = (await got.json()) as { data: { status: string; signoffEligible: boolean } };
    expect(runBody.data.status).toBe('queued');
    expect(runBody.data.signoffEligible).toBe(false);
  });

  it('internal execute-ask 口令对才跑；空口令 503；错口令 401', async () => {
    const app = buildApp({
      members: new Set(),
      gold: memoryGold(),
      evalRuns: memoryRuns(),
      enqueue: async () => 'j',
      internalToken: () => 'secret-eval',
      execute: async () =>
        ({
          httpStatus: 200,
          graph: { status: 'abstained', reason: 'low_retrieval' },
        }) as ExecuteAskResult,
    });
    const okRes = await app.request('/api/v1/internal/eval/execute-ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-eval-internal-token': 'secret-eval' },
      body: JSON.stringify({
        kbId: KB,
        tenantId: TENANT,
        userId: uuidv7(),
        question: '住宿标准？',
      }),
    });
    expect(okRes.status).toBe(200);
    const okBody = (await okRes.json()) as { data: { status: string; reason?: string } };
    expect(okBody.data.status).toBe('abstained');

    const bad = await app.request('/api/v1/internal/eval/execute-ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-eval-internal-token': 'nope' },
      body: JSON.stringify({
        kbId: KB,
        tenantId: TENANT,
        userId: uuidv7(),
        question: 'q',
      }),
    });
    expect(bad.status).toBe(401);

    const closed = buildApp({
      gold: memoryGold(),
      evalRuns: memoryRuns(),
      enqueue: async () => 'j',
      internalToken: () => '',
    });
    const off = await closed.request('/api/v1/internal/eval/execute-ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-eval-internal-token': 'secret-eval' },
      body: JSON.stringify({
        kbId: KB,
        tenantId: TENANT,
        userId: uuidv7(),
        question: 'q',
      }),
    });
    expect(off.status).toBe(503);
  });
});
