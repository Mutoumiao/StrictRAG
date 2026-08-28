/**
 * 目标：成员必须能读库 allowedModes/defaultMode，且不得经此口拿到 τ。
 * 需求：功能表 §3 问答档位
 * 被测：GET /knowledge-bases/:kbId/ask-modes
 * 简介：成员 200；非成员 403；缺库 404；缺设置回默认档；响应无 tauClaim。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import type { KbSettingsRepo } from '../../src/services/kb-settings.js';

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

function buildApp(opts: { members?: Set<string>; settings?: KbSettingsRepo }) {
  const members = opts.members ?? new Set<string>();
  const settings: KbSettingsRepo = opts.settings ?? {
    get: async () => null,
    update: async () => null,
  };
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) => (id === KB ? { id, tenantId: TENANT } : null),
      settingsRepo: settings,
    }),
  );
  return app;
}

describe('GET /knowledge-bases/:kbId/ask-modes', () => {
  it('成员可得默认档位，响应不含 tauClaim', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask-modes`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: { allowedModes: string[]; defaultMode: string; tauClaim?: unknown };
    };
    expect(body.ok).toBe(true);
    expect(body.data.allowedModes).toEqual(['strict', 'balanced', 'fast']);
    expect(body.data.defaultMode).toBe('balanced');
    expect(body.data.tauClaim).toBeUndefined();
    expect(Object.keys(body.data).sort()).toEqual(['allowedModes', 'defaultMode']);
  });

  it('成员回读库配置的 allowedModes/defaultMode', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      settings: {
        get: async () => ({
          id: KB,
          name: '演示',
          description: null,
          configJson: { allowedModes: ['strict', 'fast'], defaultMode: 'fast', tauClaim: 0.9 },
        }),
        update: async () => null,
      },
    });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask-modes`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { allowedModes: string[]; defaultMode: string; tauClaim?: unknown };
    };
    expect(body.data.allowedModes).toEqual(['strict', 'fast']);
    expect(body.data.defaultMode).toBe('fast');
    expect(body.data.tauClaim).toBeUndefined();
  });

  it('非成员 403；无令牌 401；超管对缺库 404', async () => {
    const { userId } = await token(['web_consumer']);
    const outsider = await token(['web_consumer']);
    const admin = await token(['super_admin']);
    const app = buildApp({ members: new Set([userId]) });

    const forbidden = await app.request(`/api/v1/knowledge-bases/${KB}/ask-modes`, {
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(forbidden.status).toBe(403);

    const unauth = await app.request(`/api/v1/knowledge-bases/${KB}/ask-modes`);
    expect(unauth.status).toBe(401);

    const missing = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-0000000000ff/ask-modes',
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    expect(missing.status).toBe(404);
  });
});
