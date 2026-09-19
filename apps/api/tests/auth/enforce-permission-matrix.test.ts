/**
 * 目标：AUTH_ENFORCE=true 时写入口必须按码拒绝——read（web_consumer）打上传 / 成员 / config /
 *       lifecycle / 评测一律 403，doc_operator 打审批一律 403，绕过 admin 壳也无效。
 * 需求：剧本 B1-2 · B1-8 · S2 · S3 · S8 · Y3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-051
 * 被测：requirePermissionWhenEnforced / requirePermission（挂真实路由：documents / members / kb-settings / eval / ask）
 * 简介：夹具在测试内 vi.stubEnv('AUTH_ENFORCE', 'true') 显式开启（不改仓库默认、不落 .env）；
 *       成员资格 mock 成「皆是成员」，故 403 只能来自缺码而不是非成员。对照：同一 read 令牌经成员路径 ask 仍可达。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import {
  attachAuthMiddleware,
  isAuthEnforceEnabled,
  type AuthVariables,
} from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { documentRoutes } from '../../src/routes/documents/index.js';
import { createMemberRoutes } from '../../src/routes/members.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { createEvalRoutes } from '../../src/routes/eval.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { createMemoryMembersRepo } from '../../src/services/members.js';
import { deps as graphDeps, happyChat } from '../ask/_support/graph-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const DOC = '01900000-0000-7000-8000-0000000000d9';
const TENANT = '01900000-0000-7000-8000-000000000001';

/** 身份真值走 JWT claims；成员资格一律 true，把 403 的原因收窄到「缺码」 */
vi.mock('../../src/services/members.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/members.js')>();
  return {
    ...actual,
    membersRepo: { ...actual.membersRepo, isMember: async () => true },
  };
});

/** documents 路由是模块单例（无 deps 注入），只替换本夹具会走到的方法 */
vi.mock('../../src/services/documents.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/documents.js')>();
  return {
    ...actual,
    documentRepo: {
      ...actual.documentRepo,
      listDocsByKb: async () => [],
      getKb: async (id: string) =>
        id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null,
    },
  };
});

async function token(roles: string[], app: 'admin' | 'web') {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app,
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  app.route(
    '/api/v1',
    createMemberRoutes({
      members: createMemoryMembersRepo(),
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
      resolveKbMember: async () => true,
    }),
  );
  app.route('/api/v1', createKbSettingsRoutes({ resolveKbMember: async () => true }));
  app.route('/api/v1', createEvalRoutes({ resolveKbMember: async () => true }));
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async () => true,
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
      settingsRepo: { get: async () => null, update: async () => null },
      execute: async (params) => {
        const { executeAsk } = await import('../../src/services/ask/execute.js');
        return executeAsk(params, {
          skipTrace: true,
          graphDeps: graphDeps({
            chat: happyChat,
            retrieve: async () => ({ ok: false, reason: 'low_retrieval' }),
          }),
        });
      },
      resolveOwnedSession: async () => true,
    }),
  );
  return app;
}

type WriteEntry = {
  name: string;
  method: string;
  path: string;
  code: string;
  body?: unknown;
};

/** pure read（web_consumer）能碰到的写入口族；每条都必须缺对应码 */
const PURE_READ_WRITE_ENTRIES: WriteEntry[] = [
  {
    name: '上传',
    method: 'POST',
    path: `/api/v1/knowledge-bases/${KB}/documents/upload-url`,
    code: 'doc.upload',
    body: { title: 'a.pdf', contentType: 'application/pdf' },
  },
  {
    name: 'complete',
    method: 'POST',
    path: `/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`,
    code: 'doc.upload',
    body: {},
  },
  {
    name: '成员',
    method: 'POST',
    path: `/api/v1/knowledge-bases/${KB}/members`,
    code: 'member.manage',
    body: { email: 'invitee@test.local', role: 'read' },
  },
  {
    name: 'config',
    method: 'PATCH',
    path: `/api/v1/knowledge-bases/${KB}/settings`,
    code: 'kb.config.write',
    body: { name: '新名' },
  },
  {
    name: 'lifecycle',
    method: 'PATCH',
    path: `/api/v1/documents/${DOC}/lifecycle`,
    code: 'doc.lifecycle',
    body: { lifecycle: 'active' },
  },
  {
    name: '评测',
    method: 'GET',
    path: `/api/v1/knowledge-bases/${KB}/gold-questions`,
    code: 'eval.run',
  },
];

async function call(
  app: Hono<{ Variables: AuthVariables }>,
  entry: WriteEntry,
  accessToken: string,
) {
  return app.request(entry.path, {
    method: entry.method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    ...(entry.body === undefined ? {} : { body: JSON.stringify(entry.body) }),
  });
}

describe('AUTH_ENFORCE=true 权限矩阵（测试内显式开启）', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('B1-2 · S2：read（web_consumer）六类写入口全部 403 且指名缺失码', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    expect(isAuthEnforceEnabled()).toBe(true);

    const app = buildApp();
    const { accessToken } = await token(['web_consumer'], 'web');

    for (const entry of PURE_READ_WRITE_ENTRIES) {
      const res = await call(app, entry, accessToken);
      expect(res.status, `${entry.name} 应 403`).toBe(403);
      const body = (await res.json()) as { ok: boolean; error: { code: string; message: string } };
      expect(body.ok, entry.name).toBe(false);
      expect(body.error.code, entry.name).toBe('FORBIDDEN');
      expect(body.error.message, entry.name).toContain(entry.code);
    }
  });

  it('B1-8 · Y3：doc_operator 有授权码但无 approval.decide → approve / reject 皆 403', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');

    const app = buildApp();
    const { accessToken } = await token(['doc_operator'], 'admin');
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    // 对照：同一用户确有读码（否则本条测的是「整体无权限」而非「缺审批码」）
    const list = await app.request(`/api/v1/knowledge-bases/${KB}/documents`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);

    for (const action of ['approve', 'reject']) {
      const res = await app.request(`/api/v1/documents/${DOC}/${action}`, {
        method: 'POST',
        headers,
        body: '{}',
      });
      expect(res.status, action).toBe(403);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe('FORBIDDEN');
      expect(body.error.message).toContain('approval.decide');
    }
  });

  it('S8：不挂 admin 壳中间件（等价绕过壳）写入口仍 403，且同令牌 ask 仍可达', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');

    // 本夹具只挂 api 路由：壳 Guard / 菜单裁剪不存在，403 只能来自 handler 侧验码
    const app = buildApp();
    const { accessToken } = await token(['web_consumer'], 'web');

    const upload = await call(
      app,
      PURE_READ_WRITE_ENTRIES.find((e) => e.name === '上传')!,
      accessToken,
    );
    expect(upload.status).toBe(403);
    expect(((await upload.json()) as { error: { message: string } }).error.message).toContain(
      'doc.upload',
    );

    // 对照：ask 走成员资格，不因缺运营码被牵连 → 证明 403 是矩阵判定而非身份整体失效
    const ask = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ question: '年假有多少天？' }),
    });
    expect(ask.status).toBe(200);
    expect(((await ask.json()) as { data: { status: string } }).data.status).toBe('abstained');
  });

  it('S3：read 用户三入口可达（仓库默认 AUTH_ENFORCE 关）；enforce 开时读面因缺 doc.view 收窄', async () => {
    const app = buildApp();
    const { accessToken } = await token(['web_consumer'], 'web');
    const headers = { authorization: `Bearer ${accessToken}` };

    // 仓库默认：enforce 关（demo-ingest 面与 docs/ops/auth-enforce-pilot.md 一致）
    expect(isAuthEnforceEnabled()).toBe(false);

    const ask = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ question: '年假有多少天？' }),
    });
    expect(ask.status).toBe(200);

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/documents`, { headers });
    expect(list.status).toBe(200);
    expect(((await list.json()) as { data: unknown[] }).data).toEqual([]);

    // 现状记录（口径差异，见交付汇报）：ADR-051 以码为 SSOT 后 web_consumer 无 doc.view，
    // enforce 开时「文档元数据列表可达」不成立——403 来自读面缺码，不是成员问题。
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const guarded = await app.request(`/api/v1/knowledge-bases/${KB}/documents`, { headers });
    expect(guarded.status).toBe(403);
    expect(((await guarded.json()) as { error: { message: string } }).error.message).toContain(
      'doc.view',
    );
  });
});
