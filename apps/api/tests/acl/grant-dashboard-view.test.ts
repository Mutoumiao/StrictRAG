/**
 * 目标：超管给某 kb_admin 授 dashboard.view 后该用户必须能访问数据面板；未授时 403。
 * 需求：剧本 W8（授码能力必签）· prds/10-delivery/03-acceptance-scenarios.md · ADR-049 / ADR-051
 * 被测：PUT /api/v1/admin/roles/:roleId/permissions · GET /api/v1/admin/dashboard/summary · role-hydrate
 * 简介：以 DB 角色并集为授权真值（注入 memory 仓 + setRoleAuthzLoader）；授码后同一令牌再打面板 200，
 *       证明 dashboard.view 是「可授码」而非写死在超管上。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import {
  createDbRoleAuthzLoader,
  invalidateRoleCache,
  setRoleAuthzLoader,
} from '../../src/auth/role-hydrate.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createDashboardRoutes } from '../../src/routes/dashboard.js';
import { createPlatformUsersRolesRoutes } from '../../src/routes/platform-users-roles.js';
import { createMemoryDashboardRepo } from '../../src/services/dashboard.js';
import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';
import { createMemoryPlatformUsersRolesRepo } from '../../src/services/platform-users-roles.js';

const TENANT = DEV_DEFAULT_TENANT;

type Repo = ReturnType<typeof createMemoryPlatformUsersRolesRepo>;

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

function buildApp(repo: Repo) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createPlatformUsersRolesRoutes({ repo }));
  app.route('/api/v1', createDashboardRoutes({ repo: createMemoryDashboardRepo({ kbCount: 1 }) }));
  return app;
}

describe('剧本 W8 · dashboard.view 可授码（非写死超管）', () => {
  let repo: Repo;

  beforeEach(() => {
    repo = createMemoryPlatformUsersRolesRepo();
    // 授权真值走 DB 角色并集（claims 只作回退）
    setRoleAuthzLoader(createDbRoleAuthzLoader(repo));
  });

  afterEach(() => {
    setRoleAuthzLoader(null);
    invalidateRoleCache();
  });

  it('授码前 kb_admin 打面板 403；超管授 dashboard.view 后同一令牌 200', async () => {
    const app = buildApp(repo);
    await repo.ensureSystemRoles(TENANT);
    const roles = await repo.listRoles(TENANT);
    const kbAdminRole = roles.find((r) => r.code === 'kb_admin');
    const superRole = roles.find((r) => r.code === 'super_admin');
    if (!kbAdminRole || !superRole) throw new Error('system roles missing');
    expect(kbAdminRole.codesJson).not.toContain('dashboard.view');

    // 建用户并绑 kb_admin 角色
    const target = await repo.createUser(TENANT, {
      email: 'kbam@example.com',
      displayName: 'KB Admin',
      status: 'active',
      isPlatformOperator: '1',
    });
    await repo.setUserRoles(TENANT, target.id, [kbAdminRole.id]);
    invalidateRoleCache();

    const { accessToken } = await token(['kb_admin'], target.id);
    const headers = { authorization: `Bearer ${accessToken}` };

    const before = await app.request('/api/v1/admin/dashboard/summary', { headers });
    expect(before.status).toBe(403);
    expect(((await before.json()) as { error: { message: string } }).error.message).toContain(
      'dashboard.view',
    );

    // 超管授码（ADR-051 扩授）
    const superToken = await token(['super_admin']);
    const granted = await app.request(`/api/v1/admin/roles/${kbAdminRole.id}/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${superToken.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ codes: [...kbAdminRole.codesJson, 'dashboard.view'] }),
    });
    expect(granted.status).toBe(200);

    const after = await app.request('/api/v1/admin/dashboard/summary', { headers });
    expect(after.status).toBe(200);
    const body = (await after.json()) as { data: { kbCount: number } };
    expect(body.data.kbCount).toBe(1);
  });

  it('对照：只改用户绑定时未授码仍 403（面板不放行「能进壳」）', async () => {
    const app = buildApp(repo);
    await repo.ensureSystemRoles(TENANT);
    const roles = await repo.listRoles(TENANT);
    const docOpRole = roles.find((r) => r.code === 'doc_operator');
    if (!docOpRole) throw new Error('doc_operator missing');

    const target = await repo.createUser(TENANT, {
      email: 'docop@example.com',
      displayName: 'Doc Op',
      status: 'active',
      isPlatformOperator: '1',
    });
    await repo.setUserRoles(TENANT, target.id, [docOpRole.id]);
    invalidateRoleCache();

    const { accessToken } = await token(['doc_operator'], target.id);
    const res = await app.request('/api/v1/admin/dashboard/summary', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });
});
