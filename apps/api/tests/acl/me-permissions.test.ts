/**
 * 目标：GET /me/permissions 必须回角色并集有效码，且与 /auth/me 同源。
 * 需求：prds/05-api §2.11 · 功能表 §5.1 · 剧本 Y1
 * 被测：GET /api/v1/me/permissions · GET /api/v1/auth/me
 * 简介：超管含 admin.shell / dashboard.view / role.perm.manage；不废 /auth/me。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { authRoutes, meRoutes } from '../../src/routes/auth.js';

async function token(roles: string[]) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles,
    email: 'perm@test.local',
    tenantId: '01900000-0000-7000-8000-000000000001',
  });
  return pair.accessToken;
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1/auth', authRoutes);
  app.route('/api/v1/me', meRoutes);
  return app;
}

describe('GET /api/v1/me/permissions', () => {
  it('无 Bearer → 401 UNAUTHORIZED', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/me/permissions');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('超管含 admin.shell / dashboard.view / role.perm.manage，且与 /auth/me 同源', async () => {
    const accessToken = await token(['super_admin']);
    const app = buildApp();
    const headers = { authorization: `Bearer ${accessToken}` };

    const mePerm = await app.request('/api/v1/me/permissions', { headers });
    expect(mePerm.status).toBe(200);
    const permBody = (await mePerm.json()) as { data: { permissions: string[] } };
    const codes = new Set(permBody.data.permissions);
    expect(codes.has('admin.shell')).toBe(true);
    expect(codes.has('dashboard.view')).toBe(true);
    expect(codes.has('role.perm.manage')).toBe(true);

    const authMe = await app.request('/api/v1/auth/me', { headers });
    expect(authMe.status).toBe(200);
    const meBody = (await authMe.json()) as { data: { permissions: string[] } };
    expect([...permBody.data.permissions].sort()).toEqual([...meBody.data.permissions].sort());
  });

  it('doc_operator 有 doc.upload、无 approval.decide，且与 /auth/me 同源', async () => {
    const accessToken = await token(['doc_operator']);
    const app = buildApp();
    const headers = { authorization: `Bearer ${accessToken}` };

    const mePerm = await app.request('/api/v1/me/permissions', { headers });
    expect(mePerm.status).toBe(200);
    const permBody = (await mePerm.json()) as { data: { permissions: string[] } };
    const codes = new Set(permBody.data.permissions);
    expect(codes.has('admin.shell')).toBe(true);
    expect(codes.has('doc.upload')).toBe(true);
    expect(codes.has('approval.decide')).toBe(false);
    expect(codes.has('dashboard.view')).toBe(false);

    const authMe = await app.request('/api/v1/auth/me', { headers });
    const meBody = (await authMe.json()) as { data: { permissions: string[] } };
    expect([...permBody.data.permissions].sort()).toEqual([...meBody.data.permissions].sort());
  });
});
