import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { requestIdMiddleware } from '../middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  chunkStrategy: 'structure_paragraph' as string | null,
  setCalls: [] as string[],
};

vi.mock('../services/documents.js', () => ({
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
          }
        : null,
    setChunkStrategy: async (_id: string, code: string) => {
      docState.setCalls.push(code);
      docState.chunkStrategy = code;
    },
    markCompletePending: async (_id: string, _size: number, opts?: { chunkStrategy?: string }) => {
      if (opts?.chunkStrategy) {
        docState.setCalls.push(opts.chunkStrategy);
        docState.chunkStrategy = opts.chunkStrategy;
      }
    },
  },
}));

vi.mock('../services/queue.js', () => ({
  enqueueIngest: async () => 'job-reindex-1',
}));

vi.mock('../services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: 12, contentType: 'text/plain' }),
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

// AUTH_ENFORCE off by default → WhenEnforced 放行；仍测策略闸
const { documentRoutes } = await import('./documents.js');

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

describe('B12 reindex 策略闸（X-03 已实现集合）', () => {
  afterEach(() => {
    docState.chunkStrategy = 'structure_paragraph';
    docState.setCalls = [];
    vi.unstubAllEnvs();
  });

  it('多策略 catalog reindex 未带 chunkStrategy → 400', async () => {
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
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/chunkStrategy is required/i);
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
  afterEach(() => {
    docState.chunkStrategy = null;
    docState.setCalls = [];
  });

  it('多策略且无既有策略、complete 未带 chunkStrategy → 400', async () => {
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
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toMatch(/chunkStrategy is required/i);
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
