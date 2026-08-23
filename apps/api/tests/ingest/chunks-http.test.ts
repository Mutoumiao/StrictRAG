/**
 * 目标：chunks HTTP 只读路由按成员与文档闸返回。
 * 需求：B1
 * 被测：createChunkRoutes
 * 简介：chunks HTTP。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import {
  CHUNK_BODY_MAX_BYTES,
  createMemoryChunksRepo,
  type ChunkRow,
} from '../../src/services/chunks.js';
import { createChunkRoutes } from '../../src/routes/chunks.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
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

function seedChunks(): ChunkRow[] {
  return [
    {
      id: '01900000-0000-7000-8000-0000000000c1',
      docId: DOC,
      indexVersion: 2,
      ordinal: 0,
      preview: 'preview-0',
      bodyText: 'full body zero longer than preview',
      tokenCount: 10,
    },
    {
      id: '01900000-0000-7000-8000-0000000000c2',
      docId: DOC,
      indexVersion: 2,
      ordinal: 1,
      preview: 'preview-1',
      bodyText: 'full body one',
      tokenCount: 5,
    },
    {
      id: '01900000-0000-7000-8000-0000000000c9',
      docId: DOC,
      indexVersion: 1,
      ordinal: 0,
      preview: 'old-version',
      bodyText: 'should not list',
      tokenCount: 1,
    },
  ];
}

function buildApp() {
  const repo = createMemoryChunksRepo({
    docs: [{ id: DOC, indexVersion: 2, status: 'ready', lifecycle: 'active' }],
    chunks: seedChunks(),
  });
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createChunkRoutes({ chunks: repo }));
  return app;
}

describe('chunk routes (ADR-052)', () => {
  it('doc_operator 默认无 chunk.view → 403', async () => {
    const app = buildApp();
    const { accessToken } = await token(['doc_operator']);
    const res = await app.request(`/api/v1/documents/${DOC}/chunks`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('chunk.view');
  });

  it('kb_admin list → 200；有 preview；无 body 字段；仅当前 indexVersion', async () => {
    const app = buildApp();
    const { accessToken } = await token(['kb_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/chunks?limit=10`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        indexVersion: number;
        items: Record<string, unknown>[];
        nextCursor: string | null;
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.indexVersion).toBe(2);
    expect(body.data.items).toHaveLength(2);
    for (const item of body.data.items) {
      expect(item).toHaveProperty('preview');
      expect(item).not.toHaveProperty('body');
      expect(item.indexVersion).toBe(2);
    }
  });

  it('detail → 200 + body；错 version chunk → 404', async () => {
    const app = buildApp();
    const { accessToken } = await token(['kb_admin']);
    const okRes = await app.request(
      `/api/v1/documents/${DOC}/chunks/01900000-0000-7000-8000-0000000000c1`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(okRes.status).toBe(200);
    const okBody = (await okRes.json()) as {
      data: { body: string; bodyTruncated: boolean; preview: string };
    };
    expect(okBody.data.body).toContain('full body zero');
    expect(okBody.data.bodyTruncated).toBe(false);
    expect(okBody.data.preview).toBe('preview-0');

    const old = await app.request(
      `/api/v1/documents/${DOC}/chunks/01900000-0000-7000-8000-0000000000c9`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(old.status).toBe(404);
  });

  it('分页 cursor 为 ordinal', async () => {
    const app = buildApp();
    const { accessToken } = await token(['super_admin']);
    const page1 = await app.request(`/api/v1/documents/${DOC}/chunks?limit=1`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const p1 = (await page1.json()) as {
      data: { items: { ordinal: number }[]; nextCursor: string | null };
    };
    expect(p1.data.items).toHaveLength(1);
    expect(p1.data.nextCursor).toBe('0');

    const page2 = await app.request(
      `/api/v1/documents/${DOC}/chunks?limit=1&cursor=${p1.data.nextCursor}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    const p2 = (await page2.json()) as {
      data: { items: { ordinal: number }[]; nextCursor: string | null };
    };
    expect(p2.data.items[0]?.ordinal).toBe(1);
    expect(p2.data.nextCursor).toBe('1');
  });

  it('非法 query limit → 400', async () => {
    const app = buildApp();
    const { accessToken } = await token(['kb_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/chunks?limit=999`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
  });

  it('body 超 64KiB → bodyTruncated（UTF-8 字节）', async () => {
    const big = 'x'.repeat(CHUNK_BODY_MAX_BYTES + 10);
    const repo = createMemoryChunksRepo({
      docs: [{ id: DOC, indexVersion: 1, status: 'ready', lifecycle: 'draft' }],
      chunks: [
        {
          id: '01900000-0000-7000-8000-0000000000c3',
          docId: DOC,
          indexVersion: 1,
          ordinal: 0,
          preview: 'x'.repeat(200),
          bodyText: big,
          tokenCount: null,
        },
      ],
    });
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route('/api/v1', createChunkRoutes({ chunks: repo }));
    const { accessToken } = await token(['kb_admin']);
    const res = await app.request(
      `/api/v1/documents/${DOC}/chunks/01900000-0000-7000-8000-0000000000c3`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { body: string; bodyTruncated: boolean } };
    expect(body.data.bodyTruncated).toBe(true);
    expect(Buffer.byteLength(body.data.body, 'utf8')).toBe(CHUNK_BODY_MAX_BYTES);
  });

  it('无 Bearer → 401', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/documents/${DOC}/chunks`);
    expect(res.status).toBe(401);
  });
});
