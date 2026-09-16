/**
 * 目标：文档 ACL 专用端点须按三态读写，且可见性闸与详情同口径。
 * 需求：prds/05-api §2.4 · prds/09-security §3.6.1（字段缺失=成员可读；[]=成员不可读）· 功能表 §5.2
 * 被测：GET/PUT /api/v1/documents/:docId/acl
 * 简介：GET 三态回读；名单外 403、bypass 200；PUT null/[]/名单三态且回读一致；非法 body 400；缺文 404；AUTH_ENFORCE 开时无令牌 401。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const USER_IN = '01900000-0000-7000-8000-0000000000e1';
const USER_OUT = '01900000-0000-7000-8000-0000000000e2';
const DOC_NULL = '01900000-0000-7000-8000-0000000000d1';
const DOC_EMPTY = '01900000-0000-7000-8000-0000000000d2';
const DOC_IN = '01900000-0000-7000-8000-0000000000d3';
const DOC_OUT = '01900000-0000-7000-8000-0000000000d4';

function row(id: string, aclPrincipals: string[] | null) {
  return {
    id,
    title: id,
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'active',
    tenantId: TENANT,
    kbId: KB,
    indexVersion: 1,
    aclPrincipals,
  };
}

function freshRows() {
  return [row(DOC_NULL, null), row(DOC_EMPTY, []), row(DOC_IN, [USER_IN]), row(DOC_OUT, [USER_OUT])];
}

const store = {
  rows: freshRows(),
  patchCalls: [] as Array<{ aclPrincipals?: string[] | null }>,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => store.rows.find((r) => r.id === id) ?? null,
    getKb: async () => ({ id: KB, tenantId: TENANT, configJson: {} }),
    patchMeta: async (id: string, patch: { aclPrincipals?: string[] | null }) => {
      store.patchCalls.push(patch);
      const found = store.rows.find((r) => r.id === id);
      if (found && patch.aclPrincipals !== undefined) found.aclPrincipals = patch.aclPrincipals;
    },
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token(userId: string, roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({ userId, app: 'admin', roles, tenantId: TENANT });
  return pair.accessToken;
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

async function aclOf(res: Response) {
  const body = (await res.json()) as { data: { aclPrincipals: string[] | null } };
  return body.data.aclPrincipals;
}

beforeEach(() => {
  store.rows = freshRows();
  store.patchCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /documents/:docId/acl', () => {
  it('名单缺省（null）→ 可读，回读 null', async () => {
    const res = await buildApp().request(`/api/v1/documents/${DOC_NULL}/acl`, {
      headers: { authorization: `Bearer ${await token(USER_OUT)}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { docId: string; aclPrincipals: unknown } };
    expect(body.data.docId).toBe(DOC_NULL);
    expect(body.data.aclPrincipals).toBeNull();
  });

  it('显式 [] → 非超管 403（不得把空名单读成可读）', async () => {
    const res = await buildApp().request(`/api/v1/documents/${DOC_EMPTY}/acl`, {
      headers: { authorization: `Bearer ${await token(USER_OUT)}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('名单内有我 200 / 名单外 403；超管旁路 200', async () => {
    const app = buildApp();
    const hit = await app.request(`/api/v1/documents/${DOC_IN}/acl`, {
      headers: { authorization: `Bearer ${await token(USER_IN)}` },
    });
    expect(hit.status).toBe(200);
    expect(await aclOf(hit)).toEqual([USER_IN]);

    const miss = await app.request(`/api/v1/documents/${DOC_IN}/acl`, {
      headers: { authorization: `Bearer ${await token(USER_OUT)}` },
    });
    expect(miss.status).toBe(403);

    const bypass = await app.request(`/api/v1/documents/${DOC_OUT}/acl`, {
      headers: { authorization: `Bearer ${await token(USER_OUT, ['super_admin'])}` },
    });
    expect(bypass.status).toBe(200);
    expect(await aclOf(bypass)).toEqual([USER_OUT]);
  });

  it('缺文 404', async () => {
    const res = await buildApp().request(
      '/api/v1/documents/01900000-0000-7000-8000-0000000000ff/acl',
      { headers: { authorization: `Bearer ${await token(USER_IN)}` } },
    );
    expect(res.status).toBe(404);
  });

  it('无令牌：AUTH_ENFORCE 关时按仓库现状放行（名单闸仍生效）；开启则 401', async () => {
    const app = buildApp();
    const openNull = await app.request(`/api/v1/documents/${DOC_NULL}/acl`);
    expect(openNull.status).toBe(200);
    const openEmpty = await app.request(`/api/v1/documents/${DOC_EMPTY}/acl`);
    expect(openEmpty.status).toBe(403);

    vi.stubEnv('AUTH_ENFORCE', 'true');
    const enforced = await app.request(`/api/v1/documents/${DOC_NULL}/acl`);
    expect(enforced.status).toBe(401);
  });
});

describe('PUT /documents/:docId/acl', () => {
  it('三态写：null / [] / 名单，且随后按可见性回读一致', async () => {
    const app = buildApp();
    const editor = await token(USER_IN);
    const superAdmin = await token(USER_OUT, ['super_admin']);
    const put = (docId: string, aclPrincipals: string[] | null, bearer: string) =>
      app.request(`/api/v1/documents/${docId}/acl`, {
        method: 'PUT',
        headers: { authorization: `Bearer ${bearer}`, 'content-type': 'application/json' },
        body: JSON.stringify({ aclPrincipals }),
      });

    // null → []
    const toEmpty = await put(DOC_NULL, [], editor);
    expect(toEmpty.status).toBe(200);
    expect(await aclOf(toEmpty)).toEqual([]);
    // 写成 [] 后，非名单用户（含写者自己）读不到 → 用超管旁路回读，确认真的落库
    expect(
      (await app.request(`/api/v1/documents/${DOC_NULL}/acl`, {
        headers: { authorization: `Bearer ${editor}` },
      })).status,
    ).toBe(403);
    const readBack = await app.request(`/api/v1/documents/${DOC_NULL}/acl`, {
      headers: { authorization: `Bearer ${superAdmin}` },
    });
    expect(readBack.status).toBe(200);
    expect(await aclOf(readBack)).toEqual([]);

    // [] → null（清回缺省）
    const backToDefault = await put(DOC_EMPTY, null, editor);
    expect(backToDefault.status).toBe(200);
    expect(await aclOf(backToDefault)).toBeNull();
    expect(store.rows.find((r) => r.id === DOC_EMPTY)?.aclPrincipals).toBeNull();

    // null → 具名名单
    const named = await put(DOC_OUT, [USER_IN], editor);
    expect(named.status).toBe(200);
    expect(store.rows.find((r) => r.id === DOC_OUT)?.aclPrincipals).toEqual([USER_IN]);
  });

  it('非法 body（非 uuid / 多余字段 / 缺字段）→ 400，且不写仓', async () => {
    const editor = await token(USER_IN);
    const headers = { authorization: `Bearer ${editor}`, 'content-type': 'application/json' };
    const app = buildApp();

    for (const body of [{ aclPrincipals: ['not-a-uuid'] }, { aclPrincipals: null, extra: 1 }, {}]) {
      const res = await app.request(`/api/v1/documents/${DOC_NULL}/acl`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      });
      expect(res.status).toBe(400);
    }
    expect(store.patchCalls).toHaveLength(0);
  });

  it('缺文 404，且不写仓', async () => {
    const editor = await token(USER_IN);
    const res = await buildApp().request(
      '/api/v1/documents/01900000-0000-7000-8000-0000000000ff/acl',
      {
        method: 'PUT',
        headers: { authorization: `Bearer ${editor}`, 'content-type': 'application/json' },
        body: JSON.stringify({ aclPrincipals: [] }),
      },
    );
    expect(res.status).toBe(404);
    expect(store.patchCalls).toHaveLength(0);
  });

  it('AUTH_ENFORCE 开且无 doc.editor → 403（when-enforced 码在此为强闸）', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const res = await buildApp().request(`/api/v1/documents/${DOC_NULL}/acl`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${await token(USER_IN, ['web_consumer'])}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ aclPrincipals: [] }),
    });
    expect(res.status).toBe(403);
  });
});
