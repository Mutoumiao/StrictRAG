import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { DEV_DEFAULT_TENANT } from '../services/members.js';
import {
  createMemoryPlatformUsersRolesRepo,
  SUPER_ADMIN_ROLE_CODE,
} from '../services/platform-users-roles.js';
import { createPlatformUsersRolesRoutes } from './platform-users-roles.js';

const TENANT = DEV_DEFAULT_TENANT;

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

function buildApp() {
  const repo = createMemoryPlatformUsersRolesRepo();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createPlatformUsersRolesRoutes({ repo }));
  return { app, repo };
}

async function superAdminRoleId(repo: ReturnType<typeof createMemoryPlatformUsersRolesRepo>) {
  await repo.ensureSystemRoles(TENANT);
  const roles = await repo.listRoles(TENANT);
  const sa = roles.find((r) => r.code === SUPER_ADMIN_ROLE_CODE);
  if (!sa) throw new Error('super_admin seed missing');
  return sa.id;
}

describe('platform users/roles routes (ADR-056 / B4)', () => {
  it('kb_admin 无 user.manage → users 403', async () => {
    const { accessToken } = await token(['kb_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/users', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('user.manage');
  });

  it('kb_admin 无 role.perm.manage → roles 403', async () => {
    const { accessToken } = await token(['kb_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/roles', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('role.perm.manage');
  });

  it('super_admin 列角色含四系统角色；POST 自定义合法码 → 201；非法码 → 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();

    const list = await app.request('/api/v1/admin/roles', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const listed = (await list.json()) as {
      data: Array<{ code: string; isSystem: boolean }>;
    };
    const codes = listed.data.map((r) => r.code).sort();
    expect(codes).toEqual(
      ['doc_operator', 'kb_admin', 'super_admin', 'web_consumer'].sort(),
    );
    expect(listed.data.every((r) => r.isSystem)).toBe(true);

    const bad = await app.request('/api/v1/admin/roles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code: 'custom_ops',
        name: '自定义',
        codes: ['not.a.real.code', 'admin.shell'],
      }),
    });
    expect(bad.status).toBe(400);
    const badBody = (await bad.json()) as { error: { code: string; details?: { invalid?: string[] } } };
    expect(badBody.error.code).toBe('VALIDATION_ERROR');
    expect(badBody.error.details?.invalid).toContain('not.a.real.code');

    const okCreate = await app.request('/api/v1/admin/roles', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        code: 'custom_ops',
        name: '自定义运营',
        codes: ['admin.shell', 'kb.list'],
      }),
    });
    expect(okCreate.status).toBe(201);
    const created = (await okCreate.json()) as {
      data: { id: string; code: string; codes: string[]; isSystem: boolean };
    };
    expect(created.data.code).toBe('custom_ops');
    expect(created.data.isSystem).toBe(false);
    expect(created.data.codes).toEqual(['admin.shell', 'kb.list']);
  });

  it('PUT 角色 permissions：合法 → 200；未知码 → 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    await repo.ensureSystemRoles(TENANT);
    const roles = await repo.listRoles(TENANT);
    const docOp = roles.find((r) => r.code === 'doc_operator')!;

    const bad = await app.request(`/api/v1/admin/roles/${docOp.id}/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ codes: ['admin.shell', 'nope.x'] }),
    });
    expect(bad.status).toBe(400);

    const good = await app.request(`/api/v1/admin/roles/${docOp.id}/permissions`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ codes: ['admin.shell', 'doc.view'] }),
    });
    expect(good.status).toBe(200);
    const body = (await good.json()) as { data: { codes: string[] } };
    expect(body.data.codes).toEqual(['admin.shell', 'doc.view']);
  });

  it('POST 用户 + 绑角色 → 201；GET 列表含 roleIds/roleCodes', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const saId = await superAdminRoleId(repo);
    const roles = await repo.listRoles(TENANT);
    const kbAdmin = roles.find((r) => r.code === 'kb_admin')!;

    const create = await app.request('/api/v1/admin/users', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'ops@example.com',
        displayName: 'Ops One',
        roleIds: [kbAdmin.id],
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as {
      data: {
        email: string;
        roleIds: string[];
        roleCodes: string[];
        isPlatformOperator: boolean;
      };
    };
    expect(created.data.email).toBe('ops@example.com');
    expect(created.data.roleIds).toEqual([kbAdmin.id]);
    expect(created.data.roleCodes).toEqual(['kb_admin']);
    expect(created.data.isPlatformOperator).toBe(true);

    // seed a second user as super for list noise
    await repo.createUser(TENANT, {
      email: 'sa@example.com',
      displayName: 'SA',
      status: 'active',
      isPlatformOperator: '1',
    });

    const list = await app.request('/api/v1/admin/users', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const listed = (await list.json()) as {
      data: Array<{ email: string; roleCodes: string[] }>;
    };
    const ops = listed.data.find((u) => u.email === 'ops@example.com');
    expect(ops?.roleCodes).toContain('kb_admin');
    void saId;
  });

  it('唯一 active 超管：禁用或剥 super_admin → 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const saId = await superAdminRoleId(repo);

    const only = await repo.createUser(TENANT, {
      email: 'only-sa@example.com',
      displayName: 'Only SA',
      status: 'active',
      isPlatformOperator: '1',
    });
    await repo.setUserRoles(TENANT, only.id, [saId]);

    const disable = await app.request(`/api/v1/admin/users/${only.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'disabled' }),
    });
    expect(disable.status).toBe(400);
    const dBody = (await disable.json()) as { error: { code: string; message: string } };
    expect(dBody.error.code).toBe('RULE_VIOLATION');
    expect(dBody.error.message).toContain('last active super_admin');

    const strip = await app.request(`/api/v1/admin/users/${only.id}/roles`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ roleIds: [] }),
    });
    expect(strip.status).toBe(400);
  });

  it('两个 active 超管时禁用其一 → 200', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const saId = await superAdminRoleId(repo);

    const a = await repo.createUser(TENANT, {
      email: 'sa-a@example.com',
      displayName: 'A',
      status: 'active',
      isPlatformOperator: '1',
    });
    const b = await repo.createUser(TENANT, {
      email: 'sa-b@example.com',
      displayName: 'B',
      status: 'active',
      isPlatformOperator: '1',
    });
    await repo.setUserRoles(TENANT, a.id, [saId]);
    await repo.setUserRoles(TENANT, b.id, [saId]);

    const disable = await app.request(`/api/v1/admin/users/${a.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'disabled' }),
    });
    expect(disable.status).toBe(200);
    const body = (await disable.json()) as { data: { status: string } };
    expect(body.data.status).toBe('disabled');
  });

  it('GET permission-catalog 与 admin-catalog 码一致', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/permission-catalog', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ code: string }>;
    };
    const codes = body.data.map((x) => x.code);
    expect(codes).toContain('user.manage');
    expect(codes).toContain('role.perm.manage');
    expect(codes).toContain('admin.shell');
    expect(codes).toContain('model.gateway.manage');
  });

  it('无码不可读 permission-catalog → 403', async () => {
    const { accessToken } = await token(['doc_operator']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/permission-catalog', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('禁止禁用系统 super_admin 角色 → 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const saId = await superAdminRoleId(repo);
    const res = await app.request(`/api/v1/admin/roles/${saId}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ enabled: false }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('RULE_VIOLATION');
    expect(body.error.message).toContain('cannot disable system super_admin');
  });
});
