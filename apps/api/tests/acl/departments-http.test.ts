/**
 * 目标：部门壳 HTTP 按契约读写。
 * 需求：B5
 * 被测：createDepartmentsRoutes
 * 简介：部门壳 HTTP。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';
import {
  createMemoryDepartmentsRepoWithUsers,
  type MemoryDepartmentsRepo,
} from '../../src/services/departments.js';
import { createDepartmentsRoutes } from '../../src/routes/departments.js';

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

function buildApp(repo?: MemoryDepartmentsRepo) {
  const r = repo ?? createMemoryDepartmentsRepoWithUsers();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDepartmentsRoutes({ repo: r }));
  return { app, repo: r };
}

describe('departments routes (ADR-057 / B5 shell)', () => {
  it('kb_admin 无 dept.manage → departments 403', async () => {
    const { accessToken } = await token(['kb_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/departments', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('dept.manage');
  });

  it('POST 根 + 子 → 201；GET tree 结构正确', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();

    const rootRes = await app.request('/api/v1/admin/departments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '公司', code: 'corp' }),
    });
    expect(rootRes.status).toBe(201);
    const root = (await rootRes.json()) as { data: { id: string; name: string; path: string } };
    expect(root.data.name).toBe('公司');
    expect(root.data.path).toContain(root.data.id);

    const childRes = await app.request('/api/v1/admin/departments', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '人事', parentId: root.data.id, code: 'hr' }),
    });
    expect(childRes.status).toBe(201);
    const child = (await childRes.json()) as { data: { id: string; parentId: string | null } };
    expect(child.data.parentId).toBe(root.data.id);

    const treeRes = await app.request('/api/v1/admin/departments/tree', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(treeRes.status).toBe(200);
    const tree = (await treeRes.json()) as {
      data: Array<{ id: string; name: string; children: Array<{ id: string; name: string }> }>;
    };
    expect(tree.data).toHaveLength(1);
    expect(tree.data[0]!.id).toBe(root.data.id);
    expect(tree.data[0]!.children).toHaveLength(1);
    expect(tree.data[0]!.children[0]!.name).toBe('人事');
  });

  it('PATCH parentId 成环 → 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();

    const a = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'A' }),
      })
    ).json() as { data: { id: string } };

    const b = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'B', parentId: a.data.id }),
      })
    ).json() as { data: { id: string } };

    const cycle = await app.request(`/api/v1/admin/departments/${a.data.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ parentId: b.data.id }),
    });
    expect(cycle.status).toBe(400);
    const body = (await cycle.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('RULE_VIOLATION');
    expect(body.error.message).toContain('cycle');
  });

  it('禁用部门后 PUT 归属含该 dept → 400；挂到 active → 200', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const targetUser = uuidv7();
    repo.registerUser(TENANT, targetUser);

    const active = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: '在职部' }),
      })
    ).json() as { data: { id: string } };

    const disabled = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: '停用部' }),
      })
    ).json() as { data: { id: string } };

    await app.request(`/api/v1/admin/departments/${disabled.data.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ status: 'disabled' }),
    });

    const bad = await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assignments: [{ deptId: disabled.data.id, isPrimary: true, isLeader: false }],
      }),
    });
    expect(bad.status).toBe(400);
    const badBody = (await bad.json()) as { error: { code: string } };
    expect(badBody.error.code).toBe('RULE_VIOLATION');

    const good = await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assignments: [
          { deptId: active.data.id, isPrimary: true, isLeader: true, title: '主管' },
        ],
      }),
    });
    expect(good.status).toBe(200);
    const view = (await good.json()) as {
      data: { userId: string; assignments: Array<{ isPrimary: boolean; isLeader: boolean }> };
    };
    expect(view.data.userId).toBe(targetUser);
    expect(view.data.assignments).toHaveLength(1);
    expect(view.data.assignments[0]!.isPrimary).toBe(true);
    expect(view.data.assignments[0]!.isLeader).toBe(true);
  });

  it('PUT 双 primary → 400；合法一主多兼任 → 200；GET 回显', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const targetUser = uuidv7();
    repo.registerUser(TENANT, targetUser);

    const d1 = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'D1' }),
      })
    ).json() as { data: { id: string } };
    const d2 = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'D2' }),
      })
    ).json() as { data: { id: string } };

    const dual = await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assignments: [
          { deptId: d1.data.id, isPrimary: true },
          { deptId: d2.data.id, isPrimary: true },
        ],
      }),
    });
    expect(dual.status).toBe(400);

    const okPut = await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assignments: [
          { deptId: d1.data.id, isPrimary: true, isLeader: false },
          { deptId: d2.data.id, isPrimary: false, isLeader: true },
        ],
      }),
    });
    expect(okPut.status).toBe(200);

    const get = await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(get.status).toBe(200);
    const body = (await get.json()) as {
      data: { assignments: Array<{ deptId: string; isPrimary: boolean; isLeader: boolean }> };
    };
    expect(body.data.assignments).toHaveLength(2);
    const primary = body.data.assignments.find((a) => a.isPrimary);
    expect(primary?.deptId).toBe(d1.data.id);
    const secondary = body.data.assignments.find((a) => !a.isPrimary);
    expect(secondary?.deptId).toBe(d2.data.id);
    expect(secondary?.isLeader).toBe(true);
  });

  it('DELETE 有子或有用户 → 400；空叶子 → 200', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const targetUser = uuidv7();
    repo.registerUser(TENANT, targetUser);

    const root = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: '父' }),
      })
    ).json() as { data: { id: string } };

    const child = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: '子', parentId: root.data.id }),
      })
    ).json() as { data: { id: string } };

    const delParent = await app.request(`/api/v1/admin/departments/${root.data.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(delParent.status).toBe(400);

    const leaf = await (
      await app.request('/api/v1/admin/departments', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: '叶子' }),
      })
    ).json() as { data: { id: string } };

    await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        assignments: [{ deptId: leaf.data.id, isPrimary: true }],
      }),
    });

    const delAssigned = await app.request(`/api/v1/admin/departments/${leaf.data.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(delAssigned.status).toBe(400);

    // 清空归属
    await app.request(`/api/v1/admin/users/${targetUser}/departments`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ assignments: [] }),
    });

    const delOk = await app.request(`/api/v1/admin/departments/${leaf.data.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(delOk.status).toBe(200);

    // 删无成员的子
    const delChild = await app.request(`/api/v1/admin/departments/${child.data.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(delChild.status).toBe(200);
  });

  it('无 user.manage → 用户归属 403', async () => {
    // kb_admin 无 user.manage（亦无 dept.manage）
    const { accessToken } = await token(['kb_admin']);
    const { app } = buildApp();
    const res = await app.request(`/api/v1/admin/users/${uuidv7()}/departments`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });
});
