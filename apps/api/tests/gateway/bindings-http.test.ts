/**
 * 目标：供应商绑定 HTTP 按 B3 契约读写。
 * 需求：B3
 * 被测：model-gateway routes
 * 简介：供应商绑定 HTTP。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { DEV_DEFAULT_TENANT } from '../../src/services/members.js';
import { createMemoryModelGatewayRepo } from '../../src/services/model-gateway.js';
import { createModelGatewayRoutes } from '../../src/routes/model-gateway.js';

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

function buildApp() {
  const repo = createMemoryModelGatewayRepo();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createModelGatewayRoutes({ repo }));
  return { app, repo };
}

describe('model gateway routes (ADR-055 / B3)', () => {
  it('kb_admin 默认无 model.gateway.manage → 403', async () => {
    const { accessToken } = await token(['kb_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/model-providers', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('model.gateway.manage');
  });

  it('super_admin POST Provider → 201；GET 无 apiKey 明文', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();
    const create = await app.request('/api/v1/admin/model-providers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'DeepSeek Prod',
        presetKey: 'deepseek',
        baseUrl: 'https://api.deepseek.com',
        apiKey: 'sk-super-secret',
        models: [
          { name: 'deepseek-chat', type: 'llm', enabled: true },
          { name: 'text-emb', type: 'embedding', enabled: true, dimensions: 1024 },
        ],
      }),
    });
    expect(create.status).toBe(201);
    const created = (await create.json()) as {
      ok: boolean;
      data: {
        id: string;
        hasApiKey: boolean;
        models: unknown[];
        apiKey?: string;
      };
    };
    expect(created.ok).toBe(true);
    expect(created.data.hasApiKey).toBe(true);
    expect(created.data.apiKey).toBeUndefined();
    expect(JSON.stringify(created.data)).not.toContain('sk-super-secret');
    expect(created.data.models).toHaveLength(2);

    const list = await app.request('/api/v1/admin/model-providers', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as { data: Array<{ id: string; hasApiKey: boolean }> };
    expect(listBody.data.some((p) => p.id === created.data.id && p.hasApiKey)).toBe(true);
  });

  it('PATCH 不传 apiKey 保留密钥；传新 Key 可更新', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app, repo } = buildApp();
    const create = await app.request('/api/v1/admin/model-providers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Ollama',
        presetKey: 'ollama',
        baseUrl: 'http://127.0.0.1:11434',
        apiKey: 'old-key',
        models: [{ name: 'llama3', type: 'llm', enabled: true }],
      }),
    });
    const { data } = (await create.json()) as { data: { id: string } };

    const patchName = await app.request(`/api/v1/admin/model-providers/${data.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Ollama Local' }),
    });
    expect(patchName.status).toBe(200);
    const afterName = await repo.getProvider(TENANT, data.id);
    expect(afterName?.apiKeyEnc).toBe('old-key');
    expect(afterName?.name).toBe('Ollama Local');

    const patchKey = await app.request(`/api/v1/admin/model-providers/${data.id}`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ apiKey: 'new-key' }),
    });
    expect(patchKey.status).toBe(200);
    const afterKey = await repo.getProvider(TENANT, data.id);
    expect(afterKey?.apiKeyEnc).toBe('new-key');
    const publicBody = (await patchKey.json()) as { data: { hasApiKey: boolean; apiKey?: string } };
    expect(publicBody.data.hasApiKey).toBe(true);
    expect(publicBody.data.apiKey).toBeUndefined();
  });

  it('PUT 绑定：合法 ModelRef 200；embed 绑 llm 400；judge≡judge_aux 400', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();
    const create = await app.request('/api/v1/admin/model-providers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Multi',
        presetKey: 'custom',
        baseUrl: 'http://gw',
        models: [
          { name: 'chat-a', type: 'llm', enabled: true },
          { name: 'chat-b', type: 'llm', enabled: true },
          { name: 'emb', type: 'embedding', enabled: true },
          { name: 'rr', type: 'rerank', enabled: true },
        ],
      }),
    });
    const { data: prov } = (await create.json()) as { data: { id: string } };
    const chatA = `${prov.id}#chat-a`;
    const chatB = `${prov.id}#chat-b`;
    const emb = `${prov.id}#emb`;
    const rr = `${prov.id}#rr`;

    const badType = await app.request('/api/v1/admin/model-bindings', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        bindings: { embed: { primary: chatA } },
      }),
    });
    expect(badType.status).toBe(400);

    const badJudge = await app.request('/api/v1/admin/model-bindings', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        bindings: {
          judge: { primary: chatA },
          judge_aux: { primary: chatA },
        },
      }),
    });
    expect(badJudge.status).toBe(400);
    const badBody = (await badJudge.json()) as { error: { message: string } };
    expect(badBody.error.message).toMatch(/judge/i);

    const okBind = await app.request('/api/v1/admin/model-bindings', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        bindings: {
          generate: { primary: chatA },
          judge: { primary: chatA },
          judge_aux: { primary: chatB },
          embed: { primary: emb },
          rerank: { primary: rr },
        },
      }),
    });
    expect(okBind.status).toBe(200);
    const okBody = (await okBind.json()) as {
      data: { bindings: Record<string, { primary: string }> };
    };
    expect(okBody.data.bindings.generate?.primary).toBe(chatA);
    expect(okBody.data.bindings.embed?.primary).toBe(emb);

    const getBind = await app.request('/api/v1/admin/model-bindings', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(getBind.status).toBe(200);
  });

  it('DELETE 仍被绑定的 Provider → 400；解绑后可删', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();
    const create = await app.request('/api/v1/admin/model-providers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'ToDelete',
        presetKey: 'custom',
        baseUrl: 'http://x',
        models: [{ name: 'm', type: 'llm', enabled: true }],
      }),
    });
    const { data: prov } = (await create.json()) as { data: { id: string } };
    await app.request('/api/v1/admin/model-bindings', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        bindings: { generate: { primary: `${prov.id}#m` } },
      }),
    });

    const blocked = await app.request(`/api/v1/admin/model-providers/${prov.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(blocked.status).toBe(400);

    await app.request('/api/v1/admin/model-bindings', {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bindings: {} }),
    });

    const gone = await app.request(`/api/v1/admin/model-providers/${prov.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(gone.status).toBe(200);
  });

  it('GET model-catalog 仅已启用模型；无 Key', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();
    await app.request('/api/v1/admin/model-providers', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name: 'Cat',
        presetKey: 'custom',
        baseUrl: 'http://x',
        apiKey: 'secret',
        models: [
          { name: 'on', type: 'llm', enabled: true },
          { name: 'off', type: 'llm', enabled: false },
        ],
      }),
    });
    const res = await app.request('/api/v1/model-catalog', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: Array<{ modelName: string; ref: string }>;
    };
    expect(body.data.map((x) => x.modelName)).toEqual(['on']);
    expect(JSON.stringify(body)).not.toContain('secret');
  });

  it('GET presets → 含 deepseek/ollama/custom', async () => {
    const { accessToken } = await token(['super_admin']);
    const { app } = buildApp();
    const res = await app.request('/api/v1/admin/model-providers/presets', {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ key: string }> };
    expect(body.data.map((p) => p.key).sort()).toEqual(['custom', 'deepseek', 'ollama']);
  });
});
