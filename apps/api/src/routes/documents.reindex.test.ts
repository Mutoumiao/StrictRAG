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
  chunkStrategy: 'fixed_window' as string | null,
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
            chunkStrategy: docState.chunkStrategy,
            approvalStatus: 'approved',
            status: 'ready',
          }
        : null,
    setChunkStrategy: async (_id: string, code: string) => {
      docState.setCalls.push(code);
      docState.chunkStrategy = code;
    },
  },
}));

vi.mock('../services/queue.js', () => ({
  enqueueIngest: async () => 'job-reindex-1',
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

describe('B12 reindex 策略闸（shipped path）', () => {
  afterEach(() => {
    docState.chunkStrategy = 'fixed_window';
    docState.setCalls = [];
    vi.unstubAllEnvs();
  });

  it('多策略 reindex 未带 chunkStrategy → 400', async () => {
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
    expect(body.error.message).toMatch(/chunkStrategy is required on reindex/i);
    expect(docState.setCalls).toHaveLength(0);
  });

  it('显式同策略 reindex → 200 且不改写库', async () => {
    const app = buildApp();
    const accessToken = await token(['super_admin']);
    const res = await app.request(`/api/v1/documents/${DOC}/reindex`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ chunkStrategy: 'fixed_window' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { chunkStrategy: string; strategyChanged: boolean; jobId: string };
    };
    expect(body.data.chunkStrategy).toBe('fixed_window');
    expect(body.data.strategyChanged).toBe(false);
    expect(body.data.jobId).toBe('job-reindex-1');
    expect(docState.setCalls).toHaveLength(0);
  });

  it('显式改策略 reindex → setChunkStrategy + strategyChanged', async () => {
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
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { chunkStrategy: string; strategyChanged: boolean };
    };
    expect(body.data.chunkStrategy).toBe('heading_sections');
    expect(body.data.strategyChanged).toBe(true);
    expect(docState.setCalls).toEqual(['heading_sections']);
  });
});
