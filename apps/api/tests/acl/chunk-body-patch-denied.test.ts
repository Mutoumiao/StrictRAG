/**
 * 目标：分片正文不可经 HTTP 改写；PATCH/PUT 必须拒绝且不得调用写仓。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 Z7 · ADR-052
 * 被测：PATCH/PUT /api/v1/documents/:docId/chunks/:chunkId
 * 简介：路由仅 GET list/detail。断言 404 或 405，且无 repo 写方法被调用。
 * Mongo 权威正文未接：不断言「Mongo 未变」。
 */

import { BizCode } from '@strict-rag/contracts';
import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { fail } from '../../src/lib/response.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createChunkRoutes } from '../../src/routes/chunks.js';
import {
  createMemoryChunksRepo,
  type ChunkRow,
  type ChunksRepo,
} from '../../src/services/chunks.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const CHUNK = '01900000-0000-7000-8000-0000000000c1';
const TENANT = '01900000-0000-7000-8000-000000000001';
const ORIGINAL_BODY = 'full body zero must stay unread-write';

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles,
    email: `${uuidv7().slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return pair.accessToken;
}

type WriteSpies = {
  updateBody: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
};

function spyChunksRepo(inner: ChunksRepo): ChunksRepo & WriteSpies {
  const writes: WriteSpies = {
    updateBody: vi.fn(async () => {
      throw new Error('chunk write must not be reached');
    }),
    save: vi.fn(async () => {
      throw new Error('chunk write must not be reached');
    }),
    patch: vi.fn(async () => {
      throw new Error('chunk write must not be reached');
    }),
  };
  return {
    getDoc: vi.fn(inner.getDoc.bind(inner)),
    listByDocVersion: vi.fn(inner.listByDocVersion.bind(inner)),
    getById: vi.fn(inner.getById.bind(inner)),
    ...writes,
  };
}

function buildApp() {
  const seed: ChunkRow = {
    id: CHUNK,
    docId: DOC,
    indexVersion: 2,
    ordinal: 0,
    preview: 'preview-0',
    bodyText: ORIGINAL_BODY,
    tokenCount: 10,
  };
  const inner = createMemoryChunksRepo({
    docs: [{ id: DOC, indexVersion: 2, status: 'ready', lifecycle: 'active' }],
    chunks: [seed],
  });
  const repo = spyChunksRepo(inner);
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createChunkRoutes({ chunks: repo }));
  app.notFound((c) => fail(c, BizCode.NOT_FOUND, '资源不存在', 404));
  return { app, repo, seed };
}

describe('Z7 PATCH/PUT chunk body denied', () => {
  it.each(['PATCH', 'PUT'] as const)(
    '%s /documents/:docId/chunks/:chunkId → 404 或 405，且无写仓调用',
    async (method) => {
      const { app, repo, seed } = buildApp();
      const accessToken = await token(['kb_admin']);
      const res = await app.request(`/api/v1/documents/${DOC}/chunks/${CHUNK}`, {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ body: 'tampered body' }),
      });

      expect([404, 405, 403]).toContain(res.status);
      expect(res.status).not.toBe(200);
      const body = (await res.json()) as { ok?: boolean };
      expect(body.ok).not.toBe(true);

      expect(repo.updateBody).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.patch).not.toHaveBeenCalled();
      expect(repo.getById).not.toHaveBeenCalled();
      expect(seed.bodyText).toBe(ORIGINAL_BODY);
    },
  );
});
