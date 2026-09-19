/**
 * 目标：从 0 建 KB 后必须能把 generate/embed/rerank 三个消费绑定配到位，并解析成运行时网关配置。
 * 需求：剧本 A1 · P2必签 · prds/05-api §2.1 · ADR-055
 * 被测：POST /knowledge-bases · PUT /knowledge-bases/:kbId/model-bindings · loadPlatformBindingSnapshot + applyBindingsToGatewayConfig
 * 简介：建库 → 配三通道模型 → 解析出 chat/embed/rerank 端点与模型名；未配通道回落 env 不假装已配。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';
import { clearBindingCache, loadPlatformBindingSnapshot } from '../../src/services/gateway/bindings.js';
import {
  applyBindingsToGatewayConfig,
  buildGatewayConfig,
  resolveChatModel,
  resolveEmbedModel,
  resolveRerankModel,
} from '../../src/services/gateway/resolve.js';
import { createMemoryKbSettingsAuditRepo } from '../../src/services/kb-settings-audit.js';
import { createMemoryKbSettingsRepo } from '../../src/services/kb-settings.js';
import { createMemoryModelGatewayRepo } from '../../src/services/model-gateway.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const CREATED_KB = '01900000-0000-7000-8000-0000000000cc';

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    createKb: async (input: { tenantId: string; name: string; description?: string }) => ({
      ok: true,
      kb: { id: '01900000-0000-7000-8000-0000000000cc', tenantId: input.tenantId, name: input.name },
    }),
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token(roles: string[] = ['kb_admin']) {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

async function seedGateway() {
  const gateway = createMemoryModelGatewayRepo();
  const provider = await gateway.createProvider(TENANT, {
    name: 'demo-provider',
    presetKey: 'custom',
    baseUrl: 'http://prov.local/v1',
    apiKeyEnc: 'sk-test',
    timeoutMs: 30_000,
    enabled: 1,
    notes: null,
    modelsJson: [
      { name: 'chat-a', type: 'llm', enabled: true },
      { name: 'emb-a', type: 'embedding', enabled: true, dimensions: 16 },
      { name: 'rr-a', type: 'rerank', enabled: true },
    ],
  });
  return { gateway, providerId: provider.id };
}

function envHttp() {
  return buildGatewayConfig({
    APP_ENV: 'test',
    GATEWAY_MODE: 'http',
    GATEWAY_BASE_URL: 'http://env.local/v1',
    GATEWAY_API_KEY: 'env-key',
    GATEWAY_CHAT_MODEL: 'env-chat',
    GATEWAY_EMBED_MODEL: 'env-embed',
    GATEWAY_RERANK_MODEL: 'env-rerank',
    RERANK_MIN_NODES: 1,
    GATEWAY_MAX_ATTEMPTS: 1,
  });
}

afterEach(() => {
  clearBindingCache();
});

describe('建库 → 配模型 → 可解析（A1）', () => {
  it('建 KB 后配 generate/embed/rerank，绑定落库并解析出三通道端点', async () => {
    const admin = await token();
    const settingsRepo = createMemoryKbSettingsRepo([
      { id: CREATED_KB, name: 'new-kb', description: null, configJson: {} },
    ]);
    const { gateway, providerId } = await seedGateway();

    // 1) 建库（租户只认令牌）
    const kbApp = new Hono<{ Variables: AuthVariables }>();
    kbApp.use('*', requestIdMiddleware);
    kbApp.use('*', attachAuthMiddleware);
    kbApp.route('/api/v1', documentRoutes);
    const created = await kbApp.request('/api/v1/knowledge-bases', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${admin.accessToken}`,
      },
      body: JSON.stringify({ name: 'new-kb', initialAdminUserId: admin.userId }),
    });
    expect(created.status).toBe(201);
    const kbId = ((await created.json()) as { data: { id: string } }).data.id;
    expect(kbId).toBe(CREATED_KB);

    // 2) 配 generate / embed / rerank
    const routesApp = new Hono<{ Variables: AuthVariables }>();
    routesApp.use('*', requestIdMiddleware);
    routesApp.use('*', attachAuthMiddleware);
    routesApp.route(
      '/api/v1',
      createKbSettingsRoutes({
        repo: settingsRepo,
        auditRepo: createMemoryKbSettingsAuditRepo(),
        gatewayRepo: gateway,
        qualitySnapshot: () => ({ tauClaim: 0.55, gatePackageId: null, effectiveAt: null }),
        resolveKbMember: async (userId, id) => id === kbId && userId === admin.userId,
      }),
    );

    const bindings = {
      generate: { primary: `${providerId}#chat-a` },
      embed: { primary: `${providerId}#emb-a` },
      rerank: { primary: `${providerId}#rr-a` },
    };
    const put = await routesApp.request(`/api/v1/knowledge-bases/${kbId}/model-bindings`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bindings }),
    });
    expect(put.status).toBe(200);
    const putBody = (await put.json()) as {
      ok: boolean;
      data: { bindings: Record<string, { primary: string }> };
    };
    expect(putBody.ok).toBe(true);
    expect(putBody.data.bindings.generate?.primary).toBe(bindings.generate.primary);
    expect(putBody.data.bindings.embed?.primary).toBe(bindings.embed.primary);
    expect(putBody.data.bindings.rerank?.primary).toBe(bindings.rerank.primary);

    // 3) 可解析：KB 绑定叠到 env 配置，三通道都指向 DB provider
    clearBindingCache();
    const snap = await loadPlatformBindingSnapshot(TENANT, gateway, kbId);
    const cfg = applyBindingsToGatewayConfig(envHttp(), snap);

    expect(cfg.bindingSource).toBe('mixed');
    expect(resolveChatModel(cfg, 'generate')).toBe('chat-a');
    expect(resolveEmbedModel(cfg)).toBe('emb-a');
    expect(resolveRerankModel(cfg)).toBe('rr-a');
    expect(cfg.models).toMatchObject({ chat: 'chat-a', embed: 'emb-a', rerank: 'rr-a' });
    expect(cfg.purposeEndpoints?.chat?.baseUrl).toBe('http://prov.local/v1');
    expect(cfg.purposeEndpoints?.embed?.baseUrl).toBe('http://prov.local/v1');
    expect(cfg.purposeEndpoints?.rerank?.baseUrl).toBe('http://prov.local/v1');
    expect(cfg.baseUrl).toBe('http://prov.local/v1');
    // embed 维度取绑定 provider 声明，不得沿用 env 默认
    expect(cfg.embedDims).toBe(16);
    expect(cfg.rerankEndpoints[0]).toBe('http://prov.local/v1');
  });

  it('只配 generate 时 embed/rerank 回落 env，不假装已配', async () => {
    const admin = await token();
    const settingsRepo = createMemoryKbSettingsRepo([
      { id: CREATED_KB, name: 'new-kb', description: null, configJson: {} },
    ]);
    const { gateway, providerId } = await seedGateway();

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
        resolveKbMember: async (userId, id) => id === CREATED_KB && userId === admin.userId,
      }),
    );

    const put = await app.request(`/api/v1/knowledge-bases/${CREATED_KB}/model-bindings`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${admin.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bindings: { generate: { primary: `${providerId}#chat-a` } } }),
    });
    expect(put.status).toBe(200);

    clearBindingCache();
    const snap = await loadPlatformBindingSnapshot(TENANT, gateway, CREATED_KB);
    const cfg = applyBindingsToGatewayConfig(envHttp(), snap);

    expect(resolveChatModel(cfg, 'generate')).toBe('chat-a');
    expect(cfg.purposeEndpoints?.embed).toBeUndefined();
    expect(cfg.purposeEndpoints?.rerank).toBeUndefined();
    expect(resolveEmbedModel(cfg)).toBe('env-embed');
    expect(resolveRerankModel(cfg)).toBe('env-rerank');
  });
});
