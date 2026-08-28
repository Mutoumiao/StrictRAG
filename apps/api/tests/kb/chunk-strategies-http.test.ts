/**
 * 目标：分片策略 catalog / for-upload / 库启用 PATCH 必须落库语义，无码 403，未实现不可写入。
 * 需求：功能表 §4.5 · ADR-053
 * 被测：createChunkStrategyRoutes
 * 简介：kb.config.write 写面；for-upload 给上传人选。≠ 平台 CRUD 页。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB = '01900000-0000-7000-8000-000000000099';
const TENANT = '01900000-0000-7000-8000-000000000001';

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, name: 'Demo' } : null),
  },
}));

const {
  createMemoryChunkStrategyCatalogRepo,
  setChunkStrategyCatalogRepoForTest,
} = await import('../../src/services/chunk-strategy-catalog.js');
const { createChunkStrategyRoutes } = await import('../../src/routes/chunk-strategies.js');

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

function buildApp(memberUserIds: Set<string>) {
  setChunkStrategyCatalogRepoForTest(
    createMemoryChunkStrategyCatalogRepo({
      kbId: KB,
      enabled: [
        {
          code: 'structure_paragraph',
          enabled: true,
          recommendedFamilies: ['md', 'txt', 'docx', 'pdf_text'],
        },
      ],
    }),
  );
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createChunkStrategyRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && memberUserIds.has(userId),
    }),
  );
  return app;
}

describe('chunk strategy catalog HTTP', () => {
  afterEach(() => {
    setChunkStrategyCatalogRepoForTest(null);
  });

  it('doc_operator 无 kb.config.write → 列表 403', async () => {
    const { userId, accessToken } = await token(['doc_operator']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/chunk-strategies`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });

  it('kb_admin 列表含启用与 recommended；schema 有 paramSchema', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const list = await app.request(`/api/v1/knowledge-bases/${KB}/chunk-strategies`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      data: { items: Array<{ code: string; enabled: boolean }> };
    };
    const para = listBody.data.items.find((i) => i.code === 'structure_paragraph');
    expect(para?.enabled).toBe(true);

    const schema = await app.request(`/api/v1/knowledge-bases/${KB}/chunk-strategies/schema`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(schema.status).toBe(200);
    const schemaBody = (await schema.json()) as {
      data: { items: Array<{ code: string; paramSchema: Record<string, unknown> }> };
    };
    expect(schemaBody.data.items[0]?.paramSchema).toMatchObject({ chunkTokens: 256 });
  });

  it('for-upload text/plain：仅 1 个已实现 → autoCode', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(
      `/api/v1/knowledge-bases/${KB}/chunk-strategies/for-upload?contentType=${encodeURIComponent('text/plain')}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { autoCode: string | null; requireExplicit: boolean; family: string };
    };
    expect(body.data.family).toBe('txt');
    expect(body.data.requireExplicit).toBe(false);
    expect(body.data.autoCode).toBe('structure_paragraph');
  });

  it('PATCH 启用未知码 → 400', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp(new Set([userId]));
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/chunk-strategies`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ items: [{ code: 'not_a_strategy', enabled: true }] }),
    });
    expect(res.status).toBe(400);
  });
});
