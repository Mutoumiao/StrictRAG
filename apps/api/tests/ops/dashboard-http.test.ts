/**
 * 目标：面板 summary 按 B6 返回聚合；tracks 分开展示质量与延迟且不改 summary 信封。
 * 需求：B6 · 剧本 I4
 * 被测：createDashboardRoutes / summarizeLatencies
 * 简介：summary HTTP + 双轨 tracks。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import {
  createMemoryDashboardRepo,
  summarizeLatencies,
} from '../../src/services/dashboard.js';
import { createDashboardRoutes } from '../../src/routes/dashboard.js';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp(repo = createMemoryDashboardRepo()) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDashboardRoutes({ repo }));
  return app;
}

describe('dashboard summary (B6 shell)', () => {
  it('无 dashboard.view → 403 FORBIDDEN', async () => {
    // kb_admin 默认无 dashboard.view（仅 super_admin 全码）
    const { accessToken } = await token(['kb_admin']);
    const app = buildApp();
    const res = await app.request('/api/v1/admin/dashboard/summary', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('dashboard.view');
  });

  it('有码 → 200 + shape（含 processReady boolean 与 askCount24h）', async () => {
    const { accessToken } = await token(['super_admin']);
    const repo = createMemoryDashboardRepo({
      kbCount: 2,
      documentCount: 10,
      pendingApprovalCount: 1,
      processReady: false,
      askCount24h: 4,
    });
    const app = buildApp(repo);
    const res = await app.request('/api/v1/admin/dashboard/summary', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        kbCount: number;
        documentCount: number;
        pendingApprovalCount: number;
        processReady: boolean;
        askCount24h?: number;
      };
    };
    expect(body.data.kbCount).toBe(2);
    expect(body.data.documentCount).toBe(10);
    expect(body.data.pendingApprovalCount).toBe(1);
    expect(body.data.processReady).toBe(false);
    expect(typeof body.data.processReady).toBe('boolean');
    expect(body.data.askCount24h).toBe(4);
  });

  it('无 Bearer → 401', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/admin/dashboard/summary');
    expect(res.status).toBe(401);
  });
});

describe('dashboard tracks (I4)', () => {
  it('无 dashboard.view → 403', async () => {
    const { accessToken } = await token(['kb_admin']);
    const app = buildApp();
    const res = await app.request('/api/v1/admin/dashboard/tracks', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('有码空账本 → 质量全 null、延迟零样本', async () => {
    const { accessToken } = await token(['super_admin']);
    const app = buildApp();
    const res = await app.request('/api/v1/admin/dashboard/tracks', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        quality: { evalRunId: string | null; matrix: null };
        latency: { windowHours: number; askCount: number; scoredCount: number; avgMs: number | null };
      };
    };
    expect(body.data.quality.evalRunId).toBeNull();
    expect(body.data.quality.matrix).toBeNull();
    expect(body.data.latency.windowHours).toBe(24);
    expect(body.data.latency.scoredCount).toBe(0);
    expect(body.data.latency.avgMs).toBeNull();
    expect(body.data).not.toHaveProperty('kbCount');
  });

  it('注入 L1 与 p95 回读；summary 信封不变', async () => {
    const runId = uuidv7();
    const { accessToken } = await token(['super_admin']);
    const repo = createMemoryDashboardRepo({
      kbCount: 2,
      quality: {
        evalRunId: runId,
        retrieveMode: 'mock',
        matrix: { A: 10, B: 20, C: 0, D: 30 },
        coverage: 0.33,
        hitAtK: 0.5,
        tauStar: 0.45,
        judgeAuroc: 0.8,
      },
      latency: { askCount: 10, scoredCount: 8, avgMs: 120, p95Ms: 200 },
    });
    const app = buildApp(repo);
    const tracksRes = await app.request('/api/v1/admin/dashboard/tracks', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(tracksRes.status).toBe(200);
    const tracks = (await tracksRes.json()) as {
      data: {
        quality: { evalRunId: string; matrix: { A: number }; judgeAuroc: number };
        latency: { p95Ms: number };
      };
    };
    expect(tracks.data.quality.evalRunId).toBe(runId);
    expect(tracks.data.quality.matrix.A).toBe(10);
    expect(tracks.data.quality.judgeAuroc).toBe(0.8);
    expect(tracks.data.latency.p95Ms).toBe(200);

    const summaryRes = await app.request('/api/v1/admin/dashboard/summary', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const summary = (await summaryRes.json()) as { data: Record<string, unknown> };
    expect(summary.data.kbCount).toBe(2);
    expect(summary.data).not.toHaveProperty('quality');
    expect(summary.data).not.toHaveProperty('latency');
  });

  it('无 Bearer tracks → 401', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/admin/dashboard/tracks');
    expect(res.status).toBe(401);
  });
});

describe('summarizeLatencies', () => {
  it('空样本为 null；有样本取平均与 p95', () => {
    expect(summarizeLatencies([])).toEqual({ scoredCount: 0, avgMs: null, p95Ms: null });
    const s = summarizeLatencies([100, 100, 100, 100, 200]);
    expect(s.scoredCount).toBe(5);
    expect(s.avgMs).toBe(120);
    expect(s.p95Ms).toBeGreaterThanOrEqual(100);
  });
});

describe('剧本 W6 · 面板不承载 τ / 门禁写入', () => {
  it('面板无写路由：PATCH/PUT/POST summary 与 tracks 一律 404，且响应体无 τ 字段', async () => {
    const { accessToken } = await token(['super_admin']);
    const app = buildApp();
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    for (const [method, path] of [
      ['PATCH', '/api/v1/admin/dashboard/summary'],
      ['PUT', '/api/v1/admin/dashboard/summary'],
      ['POST', '/api/v1/admin/dashboard/summary'],
      ['PATCH', '/api/v1/admin/dashboard/tracks'],
      ['POST', '/api/v1/admin/dashboard/tracks'],
    ] as const) {
      const res = await app.request(path, {
        method,
        headers,
        body: JSON.stringify({ tauClaim: 0.9 }),
      });
      expect(res.status, `${method} ${path}`).toBe(404);
    }

    const summary = await app.request('/api/v1/admin/dashboard/summary', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(summary.status).toBe(200);
    const body = (await summary.json()) as { data: Record<string, unknown> };
    expect(body.data).not.toHaveProperty('tauClaim');
    expect(body.data).not.toHaveProperty('gates');
    expect(JSON.stringify(body.data)).not.toContain('tau');
  });
});
