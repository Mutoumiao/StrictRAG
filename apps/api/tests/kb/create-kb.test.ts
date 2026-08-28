/**
 * 目标：创建知识库必须指定首位库管，且租户只认令牌、不认 body。
 * 需求：prds/05-api/01-http-api-hono.md §2.1
 * 被测：POST /knowledge-bases
 * 简介：写入 kb_members(role=admin)；缺用户 404。≠ 成员 PUT。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';

const TOKEN_TENANT = '01900000-0000-7000-8000-0000000000aa';
const BODY_TENANT = '01900000-0000-7000-8000-0000000000bb';
const ADMIN_USER = '01900000-0000-7000-8000-0000000000a1';
const MISSING_USER = '01900000-0000-7000-8000-0000000000a2';
const CREATED_ID = '01900000-0000-7000-8000-0000000000cc';

const createKbCalls: Array<{
  tenantId: string;
  name: string;
  description?: string;
  initialAdminUserId: string;
}> = [];

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    createKb: async (input: {
      tenantId: string;
      name: string;
      description?: string;
      initialAdminUserId: string;
    }) => {
      createKbCalls.push({
        tenantId: input.tenantId,
        name: input.name,
        description: input.description,
        initialAdminUserId: input.initialAdminUserId,
      });
      if (input.initialAdminUserId === MISSING_USER) {
        return { ok: false, reason: 'user_not_found' };
      }
      return {
        ok: true,
        kb: {
          id: CREATED_ID,
          tenantId: input.tenantId,
          name: input.name,
          description: input.description,
        },
      };
    },
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token(tenantId: string) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['super_admin'],
    tenantId,
  });
  return pair.accessToken;
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

describe('POST /knowledge-bases 建库闭环', () => {
  afterEach(() => {
    createKbCalls.length = 0;
  });

  it('缺 initialAdminUserId → 400 VALIDATION_ERROR，不写库', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/knowledge-bases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '演示库' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(createKbCalls).toHaveLength(0);
  });

  it('令牌 tenantId 覆盖 body tenantId，并带上首位库管', async () => {
    const app = buildApp();
    const accessToken = await token(TOKEN_TENANT);
    const res = await app.request('/api/v1/knowledge-bases', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tenantId: BODY_TENANT,
        name: '令牌租户库',
        initialAdminUserId: ADMIN_USER,
      }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      ok: boolean;
      data: { id: string; tenantId: string; name: string };
    };
    expect(body.ok).toBe(true);
    expect(body.data.tenantId).toBe(TOKEN_TENANT);
    expect(body.data.id).toBe(CREATED_ID);
    expect(createKbCalls).toEqual([
      {
        tenantId: TOKEN_TENANT,
        name: '令牌租户库',
        description: undefined,
        initialAdminUserId: ADMIN_USER,
      },
    ]);
  });

  it('无令牌时租户回落默认租户，仍写入首位库管', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/knowledge-bases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        tenantId: BODY_TENANT,
        name: '默认租户库',
        initialAdminUserId: ADMIN_USER,
      }),
    });
    expect(res.status).toBe(201);
    expect(createKbCalls).toEqual([
      {
        tenantId: DEV_DEFAULT_TENANT,
        name: '默认租户库',
        description: undefined,
        initialAdminUserId: ADMIN_USER,
      },
    ]);
  });

  it('首位库管用户不存在 → 404 NOT_FOUND', async () => {
    const app = buildApp();
    const res = await app.request('/api/v1/knowledge-bases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '缺用户库',
        initialAdminUserId: MISSING_USER,
      }),
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
  });
});
