import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { createMemoryKbSettingsRepo } from '../services/kb-settings.js';
import { createKbSettingsRoutes } from './kb-settings.js';

const KB = '01900000-0000-7000-8000-000000000099';
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

function buildApp(memberUserIds: Set<string> = new Set()) {
  const repo = createMemoryKbSettingsRepo([
    {
      id: KB,
      name: 'Demo KB',
      description: 'hello',
      configJson: { allowedModes: ['strict', 'balanced', 'fast'], defaultMode: 'balanced' },
    },
  ]);
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createKbSettingsRoutes({
      repo,
      qualitySnapshot: () => ({
        tauClaim: 0.55,
        gatePackageId: null,
        effectiveAt: null,
      }),
      resolveKbMember: async (userId, kbId) => kbId === KB && memberUserIds.has(userId),
    }),
  );
  return app;
}

describe('kb settings routes (ADR-054 / B2)', () => {
  it('doc_operator 默认无 kb.config.write → 403', async () => {
    const { userId, accessToken } = await token(['doc_operator']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('kb.config.write');
  });

  it('kb_admin 有码但非成员 → 403 membership', async () => {
    const { accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set()); // 无任何成员
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/member|kb\.config\.write/i);
  });

  it('kb_admin GET → 200；quality 只读；rewrite 锁关', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        kbId: string;
        name: string;
        qualitySnapshot: { tauClaim: number };
        sessionRewrite: { enabledDefault: boolean; locked: boolean };
        allowedModes: string[];
        defaultMode: string;
        dataClass: string;
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.kbId).toBe(KB);
    expect(body.data.name).toBe('Demo KB');
    expect(body.data.qualitySnapshot.tauClaim).toBe(0.55);
    expect(body.data.sessionRewrite).toEqual({ enabledDefault: false, locked: true });
    expect(body.data.allowedModes).toContain('balanced');
    expect(body.data.defaultMode).toBe('balanced');
    expect(body.data.dataClass).toBe('internal');
    expect(
      (body.data as { deptInheritDown?: boolean }).deptInheritDown,
    ).toBe(true);
    expect(
      (body.data as { deptAclEnforce?: boolean }).deptAclEnforce,
    ).toBe(false);
  });

  it('PATCH 白名单字段 → 200 并回读一致', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Renamed',
        description: 'new desc',
        allowedModes: ['strict', 'balanced'],
        defaultMode: 'strict',
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        name: string;
        description: string | null;
        allowedModes: string[];
        defaultMode: string;
      };
    };
    expect(body.data.name).toBe('Renamed');
    expect(body.data.description).toBe('new desc');
    expect(body.data.allowedModes).toEqual(['strict', 'balanced']);
    expect(body.data.defaultMode).toBe('strict');

    const get = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const getBody = (await get.json()) as { data: { name: string; defaultMode: string } };
    expect(getBody.data.name).toBe('Renamed');
    expect(getBody.data.defaultMode).toBe('strict');
  });

  it('PATCH dataClass=sensitive → 200 并回读', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ dataClass: 'sensitive' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { dataClass: string } };
    expect(body.data.dataClass).toBe('sensitive');

    const get = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const getBody = (await get.json()) as { data: { dataClass: string } };
    expect(getBody.data.dataClass).toBe('sensitive');
  });

  it('PATCH deptInheritDown true/false → 200 并回读', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const off = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deptInheritDown: false }),
    });
    expect(off.status).toBe(200);
    const offBody = (await off.json()) as { data: { deptInheritDown: boolean } };
    expect(offBody.data.deptInheritDown).toBe(false);

    const getOff = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const getOffBody = (await getOff.json()) as { data: { deptInheritDown: boolean } };
    expect(getOffBody.data.deptInheritDown).toBe(false);

    const on = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deptInheritDown: true }),
    });
    expect(on.status).toBe(200);
    const onBody = (await on.json()) as { data: { deptInheritDown: boolean } };
    expect(onBody.data.deptInheritDown).toBe(true);
  });

  it('PATCH deptAclEnforce true/false → 200 并回读', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const on = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deptAclEnforce: true }),
    });
    expect(on.status).toBe(200);
    const onBody = (await on.json()) as { data: { deptAclEnforce: boolean } };
    expect(onBody.data.deptAclEnforce).toBe(true);

    const getOn = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const getOnBody = (await getOn.json()) as { data: { deptAclEnforce: boolean } };
    expect(getOnBody.data.deptAclEnforce).toBe(true);

    const off = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ deptAclEnforce: false }),
    });
    expect(off.status).toBe(200);
    const offBody = (await off.json()) as { data: { deptAclEnforce: boolean } };
    expect(offBody.data.deptAclEnforce).toBe(false);
  });

  it('PATCH 非法 dataClass → 400 VALIDATION_ERROR', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ dataClass: 'public' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH 含 tauClaim → 400', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'x', tauClaim: 0.1 }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH 含 sessionRewriteEnabledDefault → 400', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ sessionRewriteEnabledDefault: true }),
    });
    expect(res.status).toBe(400);
  });

  it('PATCH defaultMode ∉ allowedModes → 400', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        allowedModes: ['strict'],
        defaultMode: 'fast',
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toContain('allowedModes');
  });

  it('未知 KB → 404', async () => {
    const { userId, accessToken } = await token(['super_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-0000000000aa/settings',
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(res.status).toBe(404);
  });
});
