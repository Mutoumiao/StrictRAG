/**
 * 目标：面板 summary HTTP 按 B6 返回聚合。
 * 需求：B6
 * 被测：createDashboardRoutes
 * 简介：面板 summary HTTP。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createMemoryDashboardRepo } from '../../src/services/dashboard.js';
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
