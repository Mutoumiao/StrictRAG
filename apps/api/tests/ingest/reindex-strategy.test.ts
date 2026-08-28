/**
 * 目标：reindex / complete 按库可用策略计数：仅 1 个可自动，≥2 未选 400，未实现 400。
 * 需求：B12 · 功能表 §4.5
 * 被测：documents reindex / complete
 * 简介：未实现 400；选择规则走 for-upload available。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  chunkStrategy: 'structure_paragraph' as string | null,
  setCalls: [] as string[],
  params: null as Record<string, unknown> | null,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: docState.chunkStrategy,
            approvalStatus: 'approved',
            status: 'ready',
            byteSize: 12,
            contentType: 'text/plain',
          }
        : null,
    setChunkStrategy: async (_id: string, code: string) => {
      docState.setCalls.push(code);
      docState.chunkStrategy = code;
    },
    markCompletePending: async (
      _id: string,
      _size: number,
      opts?: { chunkStrategy?: string; chunkStrategyParams?: Record<string, unknown> },
    ) => {
      if (opts?.chunkStrategy) {
        docState.setCalls.push(opts.chunkStrategy);
        docState.chunkStrategy = opts.chunkStrategy;
      }
      if (opts?.chunkStrategyParams) {
        docState.params = opts.chunkStrategyParams;
      }
    },
    getKb: async (id: string) =>
      id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null,
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async () => 'job-reindex-1',
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: 12, contentType: 'text/plain' }),
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

// 从域目录 shipped 入口 import（ARCH-P1a）
const { documentRoutes } = await import('../../src/routes/documents/index.js');
const {
  createMemoryChunkStrategyCatalogRepo,
  setChunkStrategyCatalogRepoForTest,
} = await import('../../src/services/chunk-strategy-catalog.js');

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles,
    tenantId: TENANT,
  });
  return pair.accessToken;
}

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

function useCatalog(codes: string[]) {
  setChunkStrategyCatalogRepoForTest(
    createMemoryChunkStrategyCatalogRepo({
      kbId: KB,
      enabled: codes.map((code) => ({
        code,
        enabled: true,
        recommendedFamilies: ['md', 'txt', 'docx', 'pdf_text'],
      })),
    }),
  );
}

describe('B12 reindex 策略闸（X-03 已实现集合）', () => {
  beforeEach(() => {
    useCatalog(['structure_paragraph']);
  });
  afterEach(() => {
    docState.chunkStrategy = 'structure_paragraph';
    docState.setCalls = [];
    docState.params = null;
    setChunkStrategyCatalogRepoForTest(null);
    vi.unstubAllEnvs();
  });

  it('仅 1 个可用 reindex 未带 chunkStrategy → 200 保留既有已实现策略', async () => {
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/reindex`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { chunkStrategy: string; strategyChanged: boolean };
    };
    expect(body.data.chunkStrategy).toBe('structure_paragraph');
    expect(body.data.strategyChanged).toBe(false);
    expect(docState.setCalls).toHaveLength(0);
  });

  it('显式同已实现策略 reindex → 200 且不改写库', async () => {
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/reindex`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chunkStrategy: 'structure_paragraph' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { chunkStrategy: string; strategyChanged: boolean; jobId: string };
    };
    expect(body.data.chunkStrategy).toBe('structure_paragraph');
    expect(body.data.strategyChanged).toBe(false);
    expect(body.data.jobId).toBe('job-reindex-1');
    expect(docState.setCalls).toHaveLength(0);
  });

  it('显式未实现策略 reindex → 400 not implemented', async () => {
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/reindex`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chunkStrategy: 'heading_sections' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/not implemented/i);
    expect(docState.setCalls).toHaveLength(0);
  });

  it('文档脏数据 fixed_window 显式改到 structure_paragraph → setChunkStrategy', async () => {
    docState.chunkStrategy = 'fixed_window';
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/reindex`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chunkStrategy: 'structure_paragraph' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { chunkStrategy: string; strategyChanged: boolean };
    };
    expect(body.data.chunkStrategy).toBe('structure_paragraph');
    expect(body.data.strategyChanged).toBe(true);
    expect(docState.setCalls).toEqual(['structure_paragraph']);
  });
});

describe('B12 complete AA3 策略闸（X-03）', () => {
  beforeEach(() => {
    useCatalog(['structure_paragraph']);
  });
  afterEach(() => {
    docState.chunkStrategy = null;
    docState.setCalls = [];
    docState.params = null;
    setChunkStrategyCatalogRepoForTest(null);
  });

  it('仅 1 个可用、complete 未带 chunkStrategy → 200 自动该策略并写参数快照', async () => {
    docState.chunkStrategy = null;
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { chunkStrategy?: string } };
    expect(body.data.chunkStrategy).toBe('structure_paragraph');
    expect(docState.params).toMatchObject({ chunkTokens: 256, contextMode: 'l1_llm' });
  });



  it('complete 显式已实现策略 → 200 并落库', async () => {
    docState.chunkStrategy = null;
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chunkStrategy: 'structure_paragraph' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { chunkStrategy?: string } };
    expect(body.data.chunkStrategy).toBe('structure_paragraph');
    expect(docState.setCalls).toContain('structure_paragraph');
  });

  it('complete 显式未实现策略 → 400', async () => {
    docState.chunkStrategy = null;
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chunkStrategy: 'heading_sections' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/not implemented/i);
  });
});
