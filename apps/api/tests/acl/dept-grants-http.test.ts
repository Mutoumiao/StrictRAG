/**
 * 目标：跨部门 grant HTTP 按 DEPT_ACL 约束；授权写入须留可追溯的操作日志。
 * 需求：DEPT_ACL · 剧本 AE7（Then 写「审计有记录」）
 * 被测：createDeptGrantsRoutes · adminWriteAuditMiddleware
 * 简介：跨部门 grant 的 CRUD、越权与校验；POST/DELETE 各留一条 dept_cross_grant_*（含 grantId），
 *      `/api/v1/admin/` 前缀在中间件层另留 admin_write。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import * as loggerMod from '../../src/logger.js';
import { adminWriteAuditMiddleware } from '../../src/middleware/admin-write-audit.js';
import type { ApiVariables } from '../../src/middleware/request-id.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createMemoryDepartmentsRepoWithUsers } from '../../src/services/departments.js';
import { createMemoryDeptGrantsRepo } from '../../src/services/dept-grants.js';
import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';
import { createMemoryPlatformUsersRolesRepo } from '../../src/services/platform-users-roles.js';
import { createDeptGrantsRoutes } from '../../src/routes/dept-grants.js';

const TENANT = DEV_DEFAULT_TENANT;

afterEach(() => {
  vi.restoreAllMocks();
});

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
  const grants = createMemoryDeptGrantsRepo();
  const departments = createMemoryDepartmentsRepoWithUsers();
  const users = createMemoryPlatformUsersRolesRepo();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDeptGrantsRoutes({ grants, departments, users }));
  return { app, grants, departments, users };
}

async function seedUserAndDept(
  users: ReturnType<typeof createMemoryPlatformUsersRolesRepo>,
  departments: ReturnType<typeof createMemoryDepartmentsRepoWithUsers>,
) {
  const user = await users.createUser(TENANT, {
    email: `${uuidv7().slice(0, 8)}@test.local`,
    displayName: '被授权人',
    status: 'active',
    isPlatformOperator: '0',
  });
  const dept = await departments.createDepartment(TENANT, {
    parentId: null,
    name: '人事',
    code: 'hr',
    path: '/',
    sort: 0,
    status: 'active',
  });
  return { userId: user.id, deptId: dept.id };
}

describe('dept-cross-grants routes (P3b-GRANT)', () => {
  it('kb_admin 无 dept.manage → 403', async () => {
    const { accessToken } = await token(['kb_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/dept-cross-grants', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('dept.manage');
  });

  it('非法 level / 非 uuid → 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, users, departments } = buildApp();
    const seeded = await seedUserAndDept(users, departments);

    const badLevel = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: seeded.deptId,
        maxVisibilityLevel: 15,
      }),
    });
    expect(badLevel.status).toBe(400);
    const levelBody = (await badLevel.json()) as { error: { code: string } };
    expect(levelBody.error.code).toBe('VALIDATION_ERROR');

    const badUuid = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId: 'not-a-uuid',
        deptId: seeded.deptId,
        maxVisibilityLevel: 20,
      }),
    });
    expect(badUuid.status).toBe(400);
    const uuidBody = (await badUuid.json()) as { error: { code: string } };
    expect(uuidBody.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST / GET / DELETE 可回读', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, users, departments } = buildApp();
    const seeded = await seedUserAndDept(users, departments);

    const createdRes = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: seeded.deptId,
        maxVisibilityLevel: 30,
        reason: 'cross-team',
      }),
    });
    expect(createdRes.status).toBe(201);
    const created = (await createdRes.json()) as {
      data: {
        id: string;
        userId: string;
        deptId: string;
        maxVisibilityLevel: number;
        grantedAt: string;
      };
    };
    expect(created.data.userId).toBe(seeded.userId);
    expect(created.data.deptId).toBe(seeded.deptId);
    expect(created.data.maxVisibilityLevel).toBe(30);
    expect(created.data.grantedAt.length).toBeGreaterThan(0);

    const listedRes = await app.request(
      `/api/v1/admin/dept-cross-grants?userId=${seeded.userId}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(listedRes.status).toBe(200);
    const listed = (await listedRes.json()) as { data: Array<{ id: string }> };
    expect(listed.data).toHaveLength(1);
    expect(listed.data[0]!.id).toBe(created.data.id);

    const delRes = await app.request(`/api/v1/admin/dept-cross-grants/${created.data.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(delRes.status).toBe(200);

    const afterRes = await app.request('/api/v1/admin/dept-cross-grants', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const after = (await afterRes.json()) as { data: Array<{ id: string }> };
    expect(after.data).toHaveLength(0);
  });

  it('用户或部门不存在 → 400 VALIDATION_ERROR', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, users, departments } = buildApp();
    const seeded = await seedUserAndDept(users, departments);
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    const missingUser = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: uuidv7(),
        deptId: seeded.deptId,
        maxVisibilityLevel: 20,
      }),
    });
    expect(missingUser.status).toBe(400);
    expect(((await missingUser.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );

    const missingDept = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: uuidv7(),
        maxVisibilityLevel: 20,
      }),
    });
    expect(missingDept.status).toBe(400);
    expect(((await missingDept.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('重复 POST 同一 (user, dept) → 409 CONFLICT', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, users, departments } = buildApp();
    const seeded = await seedUserAndDept(users, departments);
    const body = JSON.stringify({
      userId: seeded.userId,
      deptId: seeded.deptId,
      maxVisibilityLevel: 20,
    });
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    const first = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers,
      body,
    });
    expect(first.status).toBe(201);

    const dup = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers,
      body,
    });
    expect(dup.status).toBe(409);
  });

  it('非法 expiresAt / 非 uuid DELETE → 400；跨租户 list 空、delete 404', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, users, departments } = buildApp();
    const seeded = await seedUserAndDept(users, departments);
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    const badExp = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: seeded.deptId,
        maxVisibilityLevel: 20,
        expiresAt: 'tomorrow',
      }),
    });
    expect(badExp.status).toBe(400);

    const created = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: seeded.deptId,
        maxVisibilityLevel: 20,
      }),
    });
    expect(created.status).toBe(201);
    const grantId = ((await created.json()) as { data: { id: string } }).data.id;

    const badDel = await app.request('/api/v1/admin/dept-cross-grants/not-a-uuid', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(badDel.status).toBe(400);

    const otherPair = await issueTokenPair({
      userId: uuidv7(),
      app: 'admin',
      roles: ['super_admin'],
      email: 'other@test.local',
      tenantId: uuidv7(),
    });
    const listed = await app.request('/api/v1/admin/dept-cross-grants', {
      headers: { authorization: `Bearer ${otherPair.accessToken}` },
    });
    const listedBody = (await listed.json()) as { data: unknown[] };
    expect(listed.status).toBe(200);
    expect(listedBody.data).toHaveLength(0);

    const delOther = await app.request(`/api/v1/admin/dept-cross-grants/${grantId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${otherPair.accessToken}` },
    });
    expect(delOther.status).toBe(404);
  });

  it('AE7 审计 · 路由级：POST / DELETE 各留一条 dept_cross_grant_*，CREATE 带 grantId 与 actor', async () => {
    const info = vi.fn();
    vi.spyOn(loggerMod, 'childLogger').mockReturnValue({
      info,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as ReturnType<typeof loggerMod.childLogger>);

    const { accessToken, userId } = await token(['super_admin']);
    const { app, users, departments } = buildApp();
    const seeded = await seedUserAndDept(users, departments);

    const created = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: seeded.deptId,
        maxVisibilityLevel: 30,
      }),
    });
    expect(created.status).toBe(201);
    const grantId = ((await created.json()) as { data: { id: string } }).data.id;

    const del = await app.request(`/api/v1/admin/dept-cross-grants/${grantId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(del.status).toBe(200);

    const payloads = info.mock.calls.map((call) => call[0] as Record<string, unknown>);
    const create = payloads.find((p) => p.event === 'dept_cross_grant_create');
    const remove = payloads.find((p) => p.event === 'dept_cross_grant_delete');
    expect(create?.grantId).toBe(grantId);
    expect(create?.userId).toBe(seeded.userId);
    expect(create?.deptId).toBe(seeded.deptId);
    expect(remove?.grantId).toBe(grantId);
    // 日志上下文带 actor，可追溯到人
    expect(loggerMod.childLogger).toHaveBeenCalledWith(
      expect.objectContaining({ userId }),
    );
  });

  it('AE7 审计 · 中间件级：/api/v1/admin/ 前缀的 grant 写落一条 admin_write', async () => {
    const info = vi.fn();
    vi.spyOn(loggerMod, 'childLogger').mockReturnValue({
      info,
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: vi.fn(),
    } as unknown as ReturnType<typeof loggerMod.childLogger>);

    const { accessToken } = await token(['super_admin']);
    const grants = createMemoryDeptGrantsRepo();
    const departments = createMemoryDepartmentsRepoWithUsers();
    const users = createMemoryPlatformUsersRolesRepo();
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.use('*', adminWriteAuditMiddleware);
    app.route('/api/v1', createDeptGrantsRoutes({ grants, departments, users }));
    const seeded = await seedUserAndDept(users, departments);

    const res = await app.request('/api/v1/admin/dept-cross-grants', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        'x-request-id': 'req-dept-grant-audit',
      },
      body: JSON.stringify({
        userId: seeded.userId,
        deptId: seeded.deptId,
        maxVisibilityLevel: 20,
      }),
    });
    expect(res.status).toBe(201);

    const audit = info.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((p) => p.event === 'admin_write');
    expect(audit).toBeDefined();
    expect(audit?.path).toBe('/api/v1/admin/dept-cross-grants');
    expect(audit?.method).toBe('POST');
    expect(audit?.status).toBe(201);
  });
});
