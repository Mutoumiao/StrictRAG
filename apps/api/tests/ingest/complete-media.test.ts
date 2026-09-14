/**
 * 目标：complete 必须拒绝未知 MIME，checksum 不一致不得进审批。
 * 需求：ADR-039 · 功能表 §5.2 · prds/05-api complete
 * 被测：POST …/documents/:docId/complete
 * 简介：415 / 400；合法类型写入 checksum。无真集群。
 */

import { createHash } from 'node:crypto';

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const OBJECT = Buffer.alloc(12, 0x61);
const OBJECT_SUM = createHash('sha256').update(OBJECT).digest('hex');

const completeState = {
  contentType: 'text/plain' as string | null,
  title: 'note.txt',
  markCalls: [] as Array<{ id: string; size: number; checksum?: string }>,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            title: completeState.title,
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: 'structure_paragraph',
            approvalStatus: 'none',
            status: 'uploaded',
            byteSize: null,
            contentType: completeState.contentType,
            ownerDeptId: null,
          }
        : null,
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    markCompletePending: async (
      id: string,
      size: number,
      opts?: { checksumSha256?: string },
    ) => {
      completeState.markCalls.push({ id, size, checksum: opts?.checksumSha256 });
    },
    patchMeta: async () => undefined,
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: OBJECT.byteLength }),
    getObjectBuffer: async () => OBJECT,
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');
const {
  createMemoryChunkStrategyCatalogRepo,
  setChunkStrategyCatalogRepoForTest,
} = await import('../../src/services/chunk-strategy-catalog.js');

async function token() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['super_admin'],
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

describe('POST complete media / checksum gate', () => {
  afterEach(() => {
    completeState.contentType = 'text/plain';
    completeState.title = 'note.txt';
    completeState.markCalls = [];
    setChunkStrategyCatalogRepoForTest(null);
  });

  function useCatalog() {
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
  }

  it('合法 text/plain → 200 并写入 checksum', async () => {
    useCatalog();
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await token()}`,
      },
      body: '{}',
    });
    expect(res.status).toBe(200);
    expect(completeState.markCalls).toEqual([
      { id: DOC, size: OBJECT.byteLength, checksum: OBJECT_SUM },
    ]);
  });

  it('登记 octet-stream → 415 不进审批', async () => {
    useCatalog();
    completeState.contentType = 'application/octet-stream';
    completeState.title = 'payload.bin';
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await token()}`,
      },
      body: '{}',
    });
    expect(res.status).toBe(415);
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    expect(completeState.markCalls).toEqual([]);
  });

  it('declared checksum 不一致 → 400', async () => {
    useCatalog();
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${await token()}`,
      },
      body: JSON.stringify({ checksumSha256: 'b'.repeat(64) }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(completeState.markCalls).toEqual([]);
  });
});
