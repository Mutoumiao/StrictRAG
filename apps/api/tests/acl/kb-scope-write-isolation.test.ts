/**
 * 目标：同一用户对两个知识库的写权限必须按库隔离——是成员的库可写，不是成员的库一律 403。
 * 需求：剧本 S5 · prds/10-delivery/03-acceptance-scenarios.md · ADR-035 §4（无 kb_members 行 → 该 KB 内容路径 403）· ADR-051
 * 被测：createKbSettingsRoutes / createMemberRoutes（kb 作用域写）
 * 简介：用户对 KB-B 是成员、对 KB-A 非成员；同一令牌下 KB-B 写 200/201、KB-A 写 403 且文案指向成员资格。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { createMemberRoutes } from '../../src/routes/members.js';
import { createMemoryKbSettingsRepo } from '../../src/services/kb-settings.js';
import { createMemoryMembersRepo } from '../../src/services/members.js';

const KB_A = '01900000-0000-7000-8000-0000000000a1';
const KB_B = '01900000-0000-7000-8000-0000000000b1';
const TENANT = '01900000-0000-7000-8000-000000000001';

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

/** 只把 KB-B 认成成员：KB-A 的写必须被库级成员闸挡住 */
function buildApp(memberKbIds: Set<string>) {
  const resolveKbMember = async (_userId: string, kbId: string) => memberKbIds.has(kbId);
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createKbSettingsRoutes({
      repo: createMemoryKbSettingsRepo([
        { id: KB_A, name: '甲库', description: null, configJson: {} },
        { id: KB_B, name: '乙库', description: null, configJson: {} },
      ]),
      auditRepo: { insert: async () => undefined, listByKb: async () => [] },
      qualitySnapshot: async () => ({ tauClaim: 0.7, gatePackageId: null, effectiveAt: null }),
      resolveKbMember,
    }),
  );
  app.route(
    '/api/v1',
    createMemberRoutes({
      members: createMemoryMembersRepo(),
      getKb: async (id) =>
        id === KB_A || id === KB_B ? { id, tenantId: TENANT } : null,
      resolveKbMember,
    }),
  );
  return app;
}

describe('剧本 S5 · 同一用户跨两库写隔离', () => {
  it('成员库（KB-B）写设置 200 与成员 201；非成员库（KB-A）写一律 403', async () => {
    const app = buildApp(new Set([KB_B]));
    const { accessToken } = await token(['kb_admin']);
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    const allowedSettings = await app.request(`/api/v1/knowledge-bases/${KB_B}/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: '乙库改名' }),
    });
    expect(allowedSettings.status).toBe(200);

    const allowedInvite = await app.request(`/api/v1/knowledge-bases/${KB_B}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'member-b@test.local', role: 'read' }),
    });
    expect(allowedInvite.status).toBe(201);

    const deniedSettings = await app.request(`/api/v1/knowledge-bases/${KB_A}/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: '甲库改名' }),
    });
    expect(deniedSettings.status).toBe(403);
    const deniedBody = (await deniedSettings.json()) as {
      error: { code: string; message: string };
    };
    expect(deniedBody.error.code).toBe('FORBIDDEN');
    expect(deniedBody.error.message).toContain('not a knowledge base member');

    const deniedInvite = await app.request(`/api/v1/knowledge-bases/${KB_A}/members`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ email: 'member-a@test.local', role: 'read' }),
    });
    expect(deniedInvite.status).toBe(403);
  });

  it('对照：同一用户对 KB-A 是成员时同一写入可达（403 来自库级隔离，不是整体无权限）', async () => {
    const app = buildApp(new Set([KB_A, KB_B]));
    const { accessToken } = await token(['kb_admin']);

    const res = await app.request(`/api/v1/knowledge-bases/${KB_A}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '甲库改名' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { name: string } };
    expect(body.data.name).toBe('甲库改名');
  });

  it('无 kb.config.write 的纯消费者：对成员库写也 403（库隔离不能替代码闸）', async () => {
    const app = buildApp(new Set([KB_B]));
    const { accessToken } = await token(['web_consumer']);

    const res = await app.request(`/api/v1/knowledge-bases/${KB_B}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: '越权改名' }),
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('kb.config.write');
  });
});
