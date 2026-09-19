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
import { documentRoutes } from '../../src/routes/documents/index.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { createMemberRoutes } from '../../src/routes/members.js';
import { createMemoryKbSettingsRepo } from '../../src/services/kb-settings.js';
import { createMemoryMembersRepo } from '../../src/services/members.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import {
  attachAuthMiddleware,
  isAuthEnforceEnabled,
  requireKbMember,
  requireKbScope,
  requirePermission,
} from '../../src/auth/middleware.js';

/** 剧本 B1-5 / Y5：docs 路由是模块单例；本文件把成员资格钉成「非成员」，超管须靠旁路全权 */
vi.mock('../../src/services/members.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/members.js')>();
  return {
    ...actual,
    membersRepo: { ...actual.membersRepo, isMember: async () => false },
  };
});

vi.mock('../../src/services/documents.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/documents.js')>();
  const doc = {
    id: '01900000-0000-7000-8000-0000000000d5',
    kbId: '01900000-0000-7000-8000-000000000099',
    tenantId: '01900000-0000-7000-8000-000000000001',
    title: '差旅制度',
    status: 'ready',
    lifecycle: 'draft',
    approvalStatus: 'approved',
    objectKey: null,
    chunkStrategy: 'structure_paragraph',
    uploadedBy: null,
    ownerDeptId: null,
    aclPrincipals: null,
    docType: null,
    effectiveFrom: null,
    effectiveTo: null,
  };
  return {
    ...actual,
    documentRepo: {
      ...actual.documentRepo,
      listDocsByKb: async () => [],
      getKb: async (id: string) => ({
        id,
        tenantId: '01900000-0000-7000-8000-000000000001',
        configJson: {},
      }),
      getDoc: async (id: string) => (id === doc.id ? doc : null),
      patchMeta: async () => undefined,
    },
  };
});

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

describe('剧本 B1-5 / Y5 · super_admin 非成员的显式全权（真实文档路由）', () => {
  const KB_ID = '01900000-0000-7000-8000-000000000099';
  const TENANT_ID = '01900000-0000-7000-8000-000000000001';

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  /** 真实 documents 单例；成员资格 mock 为 false（非成员） */
  function buildDocApp() {
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route('/api/v1', documentRoutes);
    return app;
  }

  /** KB 设置 + 成员路由（deps 注入内存仓）；成员资格一律 false（非成员） */
  function buildManageApp() {
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route(
      '/api/v1',
      createKbSettingsRoutes({
        repo: createMemoryKbSettingsRepo([
          { id: KB_ID, name: '制度库', description: null, configJson: {} },
        ]),
        auditRepo: { insert: async () => undefined, listByKb: async () => [] },
        qualitySnapshot: async () => ({ tauClaim: 0.7, gatePackageId: null, effectiveAt: null }),
        resolveKbMember: async () => false,
      }),
    );
    app.route(
      '/api/v1',
      createMemberRoutes({
        members: createMemoryMembersRepo(),
        getKb: async (id) => (id === KB_ID ? { id: KB_ID, tenantId: TENANT_ID } : null),
        resolveKbMember: async () => false,
      }),
    );
    return app;
  }

  it('Y5：super_admin 非成员列文档 → 200（AUTH_ENFORCE=true 也放行）', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const { accessToken } = await token(['super_admin']);
    const res = await buildDocApp().request(`/api/v1/knowledge-bases/${KB_ID}/documents`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: unknown[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('B1-5：super_admin 非成员仍可管理该库（KB 设置 / 成员）→ 200；有码非超管非成员 → 403 非成员', async () => {
    const app = buildManageApp();

    const sa = await token(['super_admin']);
    const saHeaders = {
      authorization: `Bearer ${sa.accessToken}`,
      'content-type': 'application/json',
    };
    const settings = await app.request(`/api/v1/knowledge-bases/${KB_ID}/settings`, {
      method: 'PATCH',
      headers: saHeaders,
      body: JSON.stringify({ name: '改名后' }),
    });
    expect(settings.status).toBe(200);

    const invite = await app.request(`/api/v1/knowledge-bases/${KB_ID}/members`, {
      method: 'POST',
      headers: saHeaders,
      body: JSON.stringify({ email: 'newbie@test.local', role: 'read' }),
    });
    expect(invite.status).toBe(201);

    // 对照：kb_admin 有同一批码但非该库成员 → 403 且文案指向成员资格（不是缺码）
    const admin = await token(['kb_admin']);
    const denied = await app.request(`/api/v1/knowledge-bases/${KB_ID}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '不该生效' }),
    });
    expect(denied.status).toBe(403);
    const deniedBody = (await denied.json()) as { error: { code: string; message: string } };
    expect(deniedBody.error.code).toBe('FORBIDDEN');
    expect(deniedBody.error.message).toContain('not a knowledge base member');
  });
});
