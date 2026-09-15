/**
 * 目标：KB 消费绑定 PUT 只接受 generate/embed/rerank，写入 judge 必须 400。
 * 需求：功能表 §4.2 · ADR-055 · 工单「KB 消费绑定最小闭环」
 * 被测：PUT /knowledge-bases/:kbId/model-bindings
 * 简介：空 map 跟随平台；judge 不落行。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { createMemoryKbSettingsAuditRepo } from '../../src/services/kb-settings-audit.js';
import { createMemoryKbSettingsRepo } from '../../src/services/kb-settings.js';
import { createMemoryModelGatewayRepo } from '../../src/services/model-gateway.js';

const KB = '01900000-0000-7000-8000-000000000099';
const TENANT = '01900000-0000-7000-8000-000000000001';

async function token() {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles: ['kb_admin'],
    email: 'kb@test.local',
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

describe('KB 消费绑定 HTTP', () => {
  it('PUT generate 200；PUT judge 400 且不落行', async () => {
    const settingsRepo = createMemoryKbSettingsRepo([
      { id: KB, name: 'Demo KB', description: null, configJson: {} },
    ]);
    const gateway = createMemoryModelGatewayRepo();
    const provider = await gateway.createProvider(TENANT, {
      name: 'p',
      presetKey: 'custom',
      baseUrl: 'http://x',
      apiKeyEnc: null,
      timeoutMs: 1000,
      enabled: 1,
      notes: null,
      modelsJson: [
        { name: 'chat', type: 'llm', enabled: true },
        { name: 'emb', type: 'embedding', enabled: true, dimensions: 8 },
      ],
    });
    const admin = await token();
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route(
      '/api/v1',
      createKbSettingsRoutes({
        repo: settingsRepo,
        auditRepo: createMemoryKbSettingsAuditRepo(),
        gatewayRepo: gateway,
        qualitySnapshot: () => ({ tauClaim: 0.55, gatePackageId: null, effectiveAt: null }),
        resolveKbMember: async (userId, kbId) => kbId === KB && userId === admin.userId,
      }),
    );
    const access = admin.accessToken;
    const ref = `${provider.id}#chat`;

    const okRes = await app.request(`/api/v1/knowledge-bases/${KB}/model-bindings`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${access}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bindings: { generate: { primary: ref } } }),
    });
    expect(okRes.status).toBe(200);
    const okJson = (await okRes.json()) as {
      ok: boolean;
      data: { bindings: { generate?: { primary: string } } };
    };
    expect(okJson.ok).toBe(true);
    expect(okJson.data.bindings.generate?.primary).toBe(ref);

    const bad = await app.request(`/api/v1/knowledge-bases/${KB}/model-bindings`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${access}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bindings: { judge: { primary: ref } } }),
    });
    expect(bad.status).toBe(400);
    const rows = await gateway.listKbBindings(TENANT, KB);
    expect(rows.some((r) => r.purpose === 'judge')).toBe(false);
    expect(rows.some((r) => r.purpose === 'generate')).toBe(true);
  });
});
