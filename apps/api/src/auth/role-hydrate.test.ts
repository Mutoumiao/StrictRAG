import { Hono } from 'hono';
import { afterEach, describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { ok } from '../lib/response.js';
import { requestIdMiddleware, type ApiVariables } from '../middleware/request-id.js';
import { DEV_DEFAULT_TENANT } from '../services/members.js';
import {
  createMemoryPlatformUsersRolesRepo,
  SUPER_ADMIN_ROLE_CODE,
} from '../services/platform-users-roles.js';
import { issueTokenPair } from './identity/token-service.js';
import {
  attachAuthMiddleware,
  requireKbMember,
  requirePermission,
  requirePermissionWhenEnforced,
} from './middleware.js';
import {
  createDbRoleAuthzLoader,
  ensureUserRoleCodes,
  hydrateAuthz,
  invalidateRoleCache,
  ROLE_CACHE_TTL_MS,
  setRoleAuthzLoader,
} from './role-hydrate.js';

const TENANT = DEV_DEFAULT_TENANT;

afterEach(() => {
  setRoleAuthzLoader(null);
  invalidateRoleCache();
});

describe('role-hydrate (B4-W)', () => {
  it('DB 角色覆盖 JWT claims；写后 invalidate 立即生效', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    await repo.ensureSystemRoles(TENANT);
    const roles = await repo.listRoles(TENANT);
    const sa = roles.find((r) => r.code === SUPER_ADMIN_ROLE_CODE)!;
    const web = roles.find((r) => r.code === 'web_consumer')!;
    const userId = uuidv7();

    setRoleAuthzLoader(createDbRoleAuthzLoader(repo));
    await repo.setUserRoles(TENANT, userId, [sa.id]);
    invalidateRoleCache(userId);

    const first = await hydrateAuthz({
      userId,
      tenantId: TENANT,
      claimsRoles: ['web_consumer'], // 陈旧 JWT
    });
    expect(first.source).toBe('db');
    expect(first.roles).toEqual([SUPER_ADMIN_ROLE_CODE]);
    expect(first.effectiveCodes.has('admin.shell')).toBe(true);

    await repo.setUserRoles(TENANT, userId, [web.id]);
    invalidateRoleCache(userId);

    const second = await hydrateAuthz({
      userId,
      tenantId: TENANT,
      claimsRoles: [SUPER_ADMIN_ROLE_CODE],
    });
    expect(second.roles).toEqual(['web_consumer']);
    expect(second.effectiveCodes.has('admin.shell')).toBe(false);
  });

  it('≤5s 缓存命中；过期后重读', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    await repo.ensureSystemRoles(TENANT);
    const roles = await repo.listRoles(TENANT);
    const sa = roles.find((r) => r.code === SUPER_ADMIN_ROLE_CODE)!;
    const web = roles.find((r) => r.code === 'web_consumer')!;
    const userId = uuidv7();
    setRoleAuthzLoader(createDbRoleAuthzLoader(repo));
    await repo.setUserRoles(TENANT, userId, [sa.id]);
    invalidateRoleCache(userId);

    const t0 = 1_000_000;
    const a = await hydrateAuthz({
      userId,
      tenantId: TENANT,
      claimsRoles: [],
      nowMs: t0,
    });
    expect(a.roles).toEqual([SUPER_ADMIN_ROLE_CODE]);

    // 缓存期内改库但不 invalidate → 仍见旧角色
    await repo.setUserRoles(TENANT, userId, [web.id]);
    const b = await hydrateAuthz({
      userId,
      tenantId: TENANT,
      claimsRoles: [],
      nowMs: t0 + ROLE_CACHE_TTL_MS - 1,
    });
    expect(b.roles).toEqual([SUPER_ADMIN_ROLE_CODE]);

    const c = await hydrateAuthz({
      userId,
      tenantId: TENANT,
      claimsRoles: [],
      nowMs: t0 + ROLE_CACHE_TTL_MS + 1,
    });
    expect(c.roles).toEqual(['web_consumer']);
  });

  it('bootstrap ensureUserRoleCodes 可赋 super_admin', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    const userId = uuidv7();
    await ensureUserRoleCodes({
      userId,
      tenantId: TENANT,
      roleCodes: [SUPER_ADMIN_ROLE_CODE],
      repo,
    });
    setRoleAuthzLoader(createDbRoleAuthzLoader(repo));
    const h = await hydrateAuthz({
      userId,
      tenantId: TENANT,
      claimsRoles: [],
    });
    expect(h.roles).toContain(SUPER_ADMIN_ROLE_CODE);
    expect(h.effectiveCodes.has('user.manage')).toBe(true);
  });
});

describe('AUTH 兼容矩阵 × hydrate（B4-W）', () => {
  function buildApp(resolveKbMember: (u: string, k: string) => Promise<boolean>) {
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.get(
      '/probe/:kbId/ask',
      requireKbMember({ resolveKbMember }),
      (c) => ok(c, { roles: c.get('auth')?.roles ?? [] }),
    );
    app.get(
      '/probe/admin',
      requirePermission('user.manage'),
      (c) => ok(c, { ok: true }),
    );
    app.get(
      '/probe/ingest',
      requirePermissionWhenEnforced('doc.upload'),
      (c) => ok(c, { open: true }),
    );
    return app;
  }

  it('成员 ask 403 不破：web_consumer 非成员 → 403', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    setRoleAuthzLoader(createDbRoleAuthzLoader(repo));
    const userId = uuidv7();
    await ensureUserRoleCodes({
      userId,
      tenantId: TENANT,
      roleCodes: ['web_consumer'],
      repo,
    });
    const pair = await issueTokenPair({
      userId,
      app: 'web',
      roles: ['web_consumer'],
      tenantId: TENANT,
    });
    const kbId = uuidv7();
    const app = buildApp(async () => false);
    const res = await app.request(`/probe/${kbId}/ask`, {
      headers: { authorization: `Bearer ${pair.accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('not a knowledge base member');
  });

  it('DB super_admin 覆盖 JWT web_consumer → user.manage 放行', async () => {
    const repo = createMemoryPlatformUsersRolesRepo();
    setRoleAuthzLoader(createDbRoleAuthzLoader(repo));
    const userId = uuidv7();
    await ensureUserRoleCodes({
      userId,
      tenantId: TENANT,
      roleCodes: [SUPER_ADMIN_ROLE_CODE],
      repo,
    });
    // JWT 故意写 web_consumer
    const pair = await issueTokenPair({
      userId,
      app: 'admin',
      roles: ['web_consumer'],
      tenantId: TENANT,
    });
    const app = buildApp(async () => false);
    const res = await app.request('/probe/admin', {
      headers: { authorization: `Bearer ${pair.accessToken}` },
    });
    expect(res.status).toBe(200);
  });

  it('AUTH_ENFORCE=false：WhenEnforced 无 Bearer 仍放行（默认不变）', async () => {
    // 默认 env.AUTH_ENFORCE=false；本测不断言改默认
    const app = buildApp(async () => false);
    const res = await app.request('/probe/ingest');
    expect(res.status).toBe(200);
  });
});
