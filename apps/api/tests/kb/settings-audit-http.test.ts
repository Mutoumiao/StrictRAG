/**
 * 目标：PATCH settings 有 diff 须落可查询修改日志；空 diff / 失败不写；读面权限与空列表/缺库对齐。
 * 需求：功能表 §4.2 修改日志
 * 被测：PATCH/GET /knowledge-bases/:kbId/settings-audit
 * 简介：有 diff 的 PATCH → GET 见该行；空 diff 不增行；无码 403；空列表 200；缺库 404。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import type { KbSettingsAuditItem } from '@strict-rag/contracts';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { createMemoryKbSettingsAuditRepo } from '../../src/services/kb-settings-audit.js';
import { createMemoryKbSettingsRepo } from '../../src/services/kb-settings.js';

const KB = '01900000-0000-7000-8000-000000000099';
const TENANT = '01900000-0000-7000-8000-000000000001';
const MISSING = '01900000-0000-7000-8000-0000000000aa';

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

function buildApp(memberUserIds: Set<string> = new Set()) {
  const repo = createMemoryKbSettingsRepo([
    {
      id: KB,
      name: 'Demo KB',
      description: 'hello',
      configJson: { allowedModes: ['strict', 'balanced', 'fast'], defaultMode: 'balanced' },
    },
  ]);
  const auditRepo = createMemoryKbSettingsAuditRepo();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createKbSettingsRoutes({
      repo,
      auditRepo,
      qualitySnapshot: () => ({
        tauClaim: 0.55,
        gatePackageId: null,
        effectiveAt: null,
      }),
      resolveKbMember: async (userId, kbId) => kbId === KB && memberUserIds.has(userId),
    }),
  );
  return app;
}

describe('kb settings-audit routes', () => {
  it('PATCH 有 diff → GET 见该行（新在前）', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const headers = {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    };

    const patch = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Renamed' }),
    });
    expect(patch.status).toBe(200);

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { ok: boolean; data: KbSettingsAuditItem[] };
    expect(body.ok).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.kbId).toBe(KB);
    expect(body.data[0]!.actorUserId).toBe(userId);
    expect(body.data[0]!.diff.name).toEqual({ from: 'Demo KB', to: 'Renamed' });
    expect(JSON.stringify(body.data[0])).not.toMatch(/apiKey|password|tauClaim/);

    const patch2 = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'Again' }),
    });
    expect(patch2.status).toBe(200);
    const list2 = await app.request(`/api/v1/knowledge-bases/${KB}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body2 = (await list2.json()) as { data: KbSettingsAuditItem[] };
    expect(body2.data).toHaveLength(2);
    expect(body2.data[0]!.diff.name).toEqual({ from: 'Renamed', to: 'Again' });
    expect(body2.data[1]!.diff.name).toEqual({ from: 'Demo KB', to: 'Renamed' });
  });

  it('空 diff 的 PATCH 不增行', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Demo KB' }),
    });
    expect(res.status).toBe(200);

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (await list.json()) as { data: KbSettingsAuditItem[] };
    expect(body.data).toEqual([]);
  });

  it('失败 PATCH 不写行', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const bad = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'x', tauClaim: 0.1 }),
    });
    expect(bad.status).toBe(400);

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (await list.json()) as { data: KbSettingsAuditItem[] };
    expect(body.data).toEqual([]);
  });

  it('无 kb.config.write → 403', async () => {
    const { userId, accessToken } = await token(['doc_operator']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('kb.config.write');
  });

  it('空列表 200', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: KbSettingsAuditItem[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('缺库 404', async () => {
    const { userId, accessToken } = await token(['super_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${MISSING}/settings-audit`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
  });
});
