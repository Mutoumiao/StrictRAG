/**
 * 目标：待审重复块的人工二选一必须只动该块两列，且不代替持 doc.reindex 的人重跑。
 * 需求：剧本 E4 · prds/04-pipelines/01-offline-ingest.md §5.1 · 数据 PRD §3.2
 * 被测：POST /documents/:docId/dedupe-conflicts/:chunkId/resolve
 * 简介：winner=other 保留 duplicate_of；winner=this 清 duplicate_of 并回 reindexRequired；非待审 / 不存在 / 坏 body 各自拒绝。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const CHUNK = '01900000-0000-7000-8000-0000000000c1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const seed = vi.hoisted(() => ({
  rows: [] as Array<{
    chunkId: string;
    docId: string;
    kbId: string;
    indexVersion: number;
    dedupeStatus: string | null;
    duplicateOf: string | null;
  }>,
}));

vi.mock('../../src/services/dedupe-conflict.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../src/services/dedupe-conflict.js')>();
  return {
    ...actual,
    dedupeConflictRepo: {
      getChunk: async (docId: string, chunkId: string) =>
        seed.rows.find((r) => r.docId === docId && r.chunkId === chunkId) ?? null,
      resolve: async ({
        docId,
        chunkId,
        winner,
      }: {
        docId: string;
        chunkId: string;
        winner: 'this' | 'other';
      }) => {
        const row = seed.rows.find((r) => r.docId === docId && r.chunkId === chunkId);
        if (!row) return;
        row.dedupeStatus = null;
        if (winner === 'this') row.duplicateOf = null;
      },
    },
  };
});

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({ userId: uuidv7(), app: 'admin', roles, tenantId: TENANT });
  return pair.accessToken;
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);

  const resolve = (body: unknown, accessToken: string, chunkId = CHUNK) =>
    app.request(`/api/v1/documents/${DOC}/dedupe-conflicts/${chunkId}/resolve`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  return { resolve };
}

describe('跨 doc 去重冲突的人工二选一（剧本 E4）', () => {
  afterEach(() => {
    seed.rows.length = 0;
  });

  it('winner=other：判本块为重复，保留 duplicate_of，不需 reindex', async () => {
    seed.rows = [
      {
        chunkId: CHUNK,
        docId: DOC,
        kbId: KB,
        indexVersion: 1,
        dedupeStatus: 'pending_review',
        duplicateOf: '01900000-0000-7000-8000-0000000000c2',
      },
    ];
    const accessToken = await token();

    const res = await buildApp().resolve({ winner: 'other' }, accessToken);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      docId: DOC,
      chunkId: CHUNK,
      winner: 'other',
      reindexRequired: false,
    });
    expect(seed.rows[0]?.dedupeStatus).toBeNull();
    expect(seed.rows[0]?.duplicateOf).toBe('01900000-0000-7000-8000-0000000000c2');
  });

  it('winner=this：本块为正牌，清 duplicate_of，回 reindexRequired=true（不代跑）', async () => {
    seed.rows = [
      {
        chunkId: CHUNK,
        docId: DOC,
        kbId: KB,
        indexVersion: 1,
        dedupeStatus: 'pending_review',
        duplicateOf: '01900000-0000-7000-8000-0000000000c2',
      },
    ];
    const accessToken = await token();

    const res = await buildApp().resolve({ winner: 'this' }, accessToken);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({ winner: 'this', reindexRequired: true });
    expect(seed.rows[0]?.dedupeStatus).toBeNull();
    expect(seed.rows[0]?.duplicateOf).toBeNull();
  });

  it('非待审块 → 400，且不改任何数据', async () => {
    seed.rows = [
      {
        chunkId: CHUNK,
        docId: DOC,
        kbId: KB,
        indexVersion: 1,
        dedupeStatus: null,
        duplicateOf: '01900000-0000-7000-8000-0000000000c2',
      },
    ];
    const accessToken = await token();

    const res = await buildApp().resolve({ winner: 'this' }, accessToken);

    expect(res.status).toBe(400);
    expect(seed.rows[0]?.duplicateOf).toBe('01900000-0000-7000-8000-0000000000c2');
  });

  it('块不存在 → 404', async () => {
    const accessToken = await token();
    const res = await buildApp().resolve(
      { winner: 'this' },
      accessToken,
      '01900000-0000-7000-8000-0000000000ff',
    );
    expect(res.status).toBe(404);
  });

  it('坏 body（缺 winner / 未知 winner）→ 400', async () => {
    const accessToken = await token();
    const { resolve } = buildApp();
    expect((await resolve({}, accessToken)).status).toBe(400);
    expect((await resolve({ winner: 'both' }, accessToken)).status).toBe(400);
  });
});
