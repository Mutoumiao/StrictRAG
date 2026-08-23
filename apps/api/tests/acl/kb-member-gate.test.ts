/**
 * 目标：无 KB 成员必须 403，授权以码为准。
 * 需求：以码为准
 * 被测：requireKbMember / requirePermission
 * 简介：无成员 403。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { ok } from '../../src/lib/response.js';
import { requestIdMiddleware, type ApiVariables } from '../../src/middleware/request-id.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import {
  attachAuthMiddleware,
  isAuthEnforceEnabled,
  requireKbMember,
  requireKbScope,
  requirePermission,
} from '../../src/auth/middleware.js';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: '01900000-0000-7000-8000-000000000001',
  });
  return { userId, accessToken: pair.accessToken };
}

/** 独立小 app：测中间件，不查真库 */
function buildProbe(resolveKbMember: (userId: string, kbId: string) => Promise<boolean>) {
  const app = new Hono<{ Variables: ApiVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);

  app.get(
    '/probe/:kbId/ask',
    requireKbMember({ resolveKbMember }),
    (c) => ok(c, { entered: true, userId: c.get('auth')?.userId }),
  );

  app.get(
    '/probe/:kbId/manage',
    requirePermission('member.manage', { resolveKbMember }),
    (c) => ok(c, { managed: true }),
  );

  app.get('/probe/no-kb', requireKbMember({ resolveKbMember }), (c) => ok(c, {}));

  return app;
}

describe('requireKbMember / requirePermission kb gate', () => {
  const kbId = '01900000-0000-7000-8000-000000000099';

  it('non-member ask → 403 FORBIDDEN', async () => {
    const members = new Set<string>();
    const app = buildProbe(async (userId, id) => id === kbId && members.has(userId));
    const { accessToken } = await token(['web_consumer']);

    const res = await app.request(`/probe/${kbId}/ask`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('not a knowledge base member');
  });

  it('member ask → 200', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const members = new Set([userId]);
    const app = buildProbe(async (uid, id) => id === kbId && members.has(uid));

    const res = await app.request(`/probe/${kbId}/ask`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { entered: boolean } };
    expect(body.ok).toBe(true);
    expect(body.data.entered).toBe(true);
  });

  it('super_admin ask without membership → 200', async () => {
    const app = buildProbe(async () => false);
    const { accessToken } = await token(['super_admin']);

    const res = await app.request(`/probe/${kbId}/ask`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
  });

  it('no bearer → 401', async () => {
    const app = buildProbe(async () => true);
    const res = await app.request(`/probe/${kbId}/ask`);
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('kb_admin missing member.manage path: non-member → 403 membership', async () => {
    const app = buildProbe(async () => false);
    const { accessToken } = await token(['kb_admin']);

    const res = await app.request(`/probe/${kbId}/manage`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('not a knowledge base member');
  });

  it('kb_admin member.manage + member → 200', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildProbe(async (uid) => uid === userId);

    const res = await app.request(`/probe/${kbId}/manage`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
  });

  it('doc_operator lacks member.manage → 403 missing permission', async () => {
    const { userId, accessToken } = await token(['doc_operator']);
    const app = buildProbe(async (uid) => uid === userId);

    const res = await app.request(`/probe/${kbId}/manage`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('missing permission: member.manage');
  });

  it('requireKbMember without :kbId → 400', async () => {
    const app = buildProbe(async () => true);
    const { accessToken } = await token(['super_admin']);
    const res = await app.request('/probe/no-kb', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
  });
});

describe('member routes validation (no DB)', () => {
  it('POST members without auth → 401', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();
    const res = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-000000000099/members',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com' }),
      },
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('GET members without auth → 401', async () => {
    const { createApp } = await import('../../src/app.js');
    const app = createApp();
    const res = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-000000000099/members',
    );
    expect(res.status).toBe(401);
  });
});

describe('ARCH-P1b-1 requireKbScope + request-scoped membership cache', () => {
  const kbId = '01900000-0000-7000-8000-000000000088';

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('链式 requirePermission + requireKbMember 同请求 → resolve 只 1 次', async () => {
    const resolve = vi.fn(async () => true);
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.get(
      '/probe/:kbId/chain',
      requirePermission('member.manage', { resolveKbMember: resolve }),
      requireKbMember({ resolveKbMember: resolve }),
      (c) => ok(c, { chained: true }),
    );

    const { userId, accessToken } = await token(['kb_admin']);
    void userId;
    const res = await app.request(`/probe/${kbId}/chain`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('requireKbScope() 无 permission：非成员 → 403', async () => {
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.get(
      '/probe/:kbId/scope-member',
      requireKbScope({ resolveKbMember: async () => false }),
      (c) => ok(c, {}),
    );
    const { accessToken } = await token(['web_consumer']);
    const res = await app.request(`/probe/${kbId}/scope-member`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('not a knowledge base member');
  });

  it('requireKbScope({ permission }) 有码+成员 → 200', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.get(
      '/probe/:kbId/scope-perm',
      requireKbScope({
        permission: 'member.manage',
        resolveKbMember: async (uid) => uid === userId,
      }),
      (c) => ok(c, { ok: true }),
    );
    const res = await app.request(`/probe/${kbId}/scope-perm`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
  });

  it('requireKbScope whenEnforced：默认关无 Bearer 放行', async () => {
    expect(isAuthEnforceEnabled()).toBe(false);
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.post(
      '/probe/:kbId/upload',
      requireKbScope({
        permission: 'doc.upload',
        whenEnforced: true,
        resolveKbMember: async () => false,
      }),
      (c) => ok(c, { uploaded: true }, 201),
    );
    const res = await app.request(`/probe/${kbId}/upload`, { method: 'POST' });
    expect(res.status).toBe(201);
  });

  it('requireKbScope whenEnforced + AUTH_ENFORCE=true 无 Bearer → 401', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.post(
      '/probe/:kbId/upload',
      requireKbScope({
        permission: 'doc.upload',
        whenEnforced: true,
      }),
      (c) => ok(c, { uploaded: true }, 201),
    );
    const res = await app.request(`/probe/${kbId}/upload`, { method: 'POST' });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('UNAUTHORIZED');
  });
});
