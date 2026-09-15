/**
 * 目标：PATCH 类型分区后 GET settings 与成员 GET /doc-types 必须回读启用项真 label。
 * 需求：功能表 §4.2 / §5.2 · ADR-054 · ADR-050 · 工单「类型分区 CRUD 最小闭环」
 * 被测：PATCH /knowledge-bases/:kbId/settings · GET /doc-types
 * 简介：重复码 400；停用不出成员枚举。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { createMemoryKbSettingsAuditRepo } from '../../src/services/kb-settings-audit.js';
import { createMemoryKbSettingsRepo, type KbSettingsRepo } from '../../src/services/kb-settings.js';

const KB = '01900000-0000-7000-8000-000000000099';
const TENANT = '01900000-0000-7000-8000-000000000001';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: roles.includes('web_consumer') && !roles.includes('kb_admin') ? 'web' : 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp(repo: KbSettingsRepo, memberUserIds: Set<string>) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createKbSettingsRoutes({
      repo,
      auditRepo: createMemoryKbSettingsAuditRepo(),
      qualitySnapshot: () => ({ tauClaim: 0.55, gatePackageId: null, effectiveAt: null }),
      resolveKbMember: async (userId, kbId) => kbId === KB && memberUserIds.has(userId),
    }),
  );
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && memberUserIds.has(userId),
      getKb: async (id) => (id === KB ? { id, tenantId: TENANT } : null),
      settingsRepo: repo,
    }),
  );
  return app;
}

describe('类型分区 HTTP', () => {
  it('PATCH catalog 200 回读；成员 GET 只含启用且真 label', async () => {
    const admin = await token(['kb_admin']);
    const member = await token(['web_consumer']);
    const members = new Set([admin.userId, member.userId]);
    const repo = createMemoryKbSettingsRepo([
      {
        id: KB,
        name: 'Demo KB',
        description: null,
        configJson: {},
      },
    ]);
    const app = buildApp(repo, members);

    const patch = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        docTypeItems: [
          { code: 'hr', label: '人事', sort: 0, enabled: true },
          { code: 'legal', label: '法务', sort: 1, enabled: false },
        ],
      }),
    });
    expect(patch.status).toBe(200);
    const patched = (await patch.json()) as {
      data: {
        docTypes: string[];
        docTypeItems: { code: string; label: string; enabled: boolean }[];
      };
    };
    expect(patched.data.docTypes).toEqual(['hr']);
    expect(patched.data.docTypeItems).toEqual([
      { code: 'hr', label: '人事', sort: 0, enabled: true },
      { code: 'legal', label: '法务', sort: 1, enabled: false },
    ]);

    const listed = await app.request(`/api/v1/knowledge-bases/${KB}/doc-types`, {
      headers: { authorization: `Bearer ${member.accessToken}` },
    });
    expect(listed.status).toBe(200);
    const body = (await listed.json()) as {
      data: { items: { code: string; label: string }[] };
    };
    expect(body.data.items).toEqual([{ code: 'hr', label: '人事' }]);
  });

  it('PATCH 重复码 400', async () => {
    const admin = await token(['kb_admin']);
    const repo = createMemoryKbSettingsRepo([
      { id: KB, name: 'Demo KB', description: null, configJson: {} },
    ]);
    const app = buildApp(repo, new Set([admin.userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        docTypeItems: [
          { code: 'hr', label: '人事', sort: 0, enabled: true },
          { code: 'hr', label: '重复', sort: 1, enabled: true },
        ],
      }),
    });
    expect(res.status).toBe(400);
  });
});
