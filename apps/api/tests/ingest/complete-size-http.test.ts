/**
 * 目标：complete 的体积闸必须以对象 Head 为权威——超限对象不得进审批，PG 侧不存在 uploaded 成功路径。
 * 需求：剧本 M1 · prds/10-delivery/03-acceptance-scenarios.md · ADR-039
 * 被测：POST /api/v1/knowledge-bases/:kbId/documents/:docId/complete
 * 简介：mock 仓 + headObject 返回超限 → 413 PAYLOAD_TOO_LARGE，且 markCompletePending 未被调用、正文未被读；
 *       同夹具在限额内作对照 → 200 并落 pending。无真存储 / 无 Docker。
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
const MAX_BYTES = 10_000_000;

const storageState = {
  headBytes: MAX_BYTES + 1,
  headCalls: 0,
  bodyReads: 0,
  markCalls: [] as Array<{ id: string; size: number; uploadedBy?: string }>,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            title: 'oversize.pdf',
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: 'structure_paragraph',
            approvalStatus: 'none',
            status: 'uploaded',
            byteSize: null,
            contentType: 'application/pdf',
            ownerDeptId: null,
            aclPrincipals: null,
          }
        : null,
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    markCompletePending: async (id: string, size: number, opts?: { uploadedBy?: string }) => {
      storageState.markCalls.push({ id, size, uploadedBy: opts?.uploadedBy });
    },
    patchMeta: async () => undefined,
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => {
      storageState.headCalls += 1;
      return { byteSize: storageState.headBytes };
    },
    getObjectBuffer: async () => {
      storageState.bodyReads += 1;
      return Buffer.alloc(storageState.headBytes, 0x61);
    },
    createUploadSlot: (kbId: string, docId: string, contentType: string) => ({
      bucket: 'strict-rag',
      key: `kb/${kbId}/docs/${docId}/object`,
      contentType,
      uploadUrl: '/api/v1/internal/objects?key=x',
      method: 'PUT',
    }),
    putObject: async () => ({ key: 'x', byteSize: 1, checksumSha256: 'f'.repeat(64) }),
  }),
  effectiveMaxUploadBytes: () => MAX_BYTES,
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');
const { createMemoryChunkStrategyCatalogRepo, setChunkStrategyCatalogRepoForTest } =
  await import('../../src/services/chunk-strategy-catalog.js');

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

async function complete() {
  const app = buildApp();
  return app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
    body: '{}',
  });
}

beforeEach(() => {
  storageState.headBytes = MAX_BYTES + 1;
  storageState.headCalls = 0;
  storageState.bodyReads = 0;
  storageState.markCalls = [];
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
});

afterEach(() => {
  setChunkStrategyCatalogRepoForTest(null);
});

describe('剧本 M1 · complete 体积闸的 handler 路径', () => {
  it('超限对象 → 413 / PAYLOAD_TOO_LARGE，PG 无 uploaded 成功路径', async () => {
    const res = await complete();

    expect(res.status).toBe(413);
    const body = (await res.json()) as {
      ok: boolean;
      error?: { code: string; details?: { maxBytes?: number; actual?: number } };
    };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('PAYLOAD_TOO_LARGE');
    expect(body.error?.details).toEqual({ maxBytes: MAX_BYTES, actual: MAX_BYTES + 1 });

    expect(storageState.headCalls).toBe(1);
    // 体积闸先于正文读取与落库：不 markCompletePending、不读正文
    expect(storageState.markCalls).toEqual([]);
    expect(storageState.bodyReads).toBe(0);
  });

  it('对照：同一 handler 在限额内 → 200 且落 pending', async () => {
    storageState.headBytes = 1_024;

    const res = await complete();

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { byteSize: number; approvalStatus: string; status: string };
    };
    expect(body.data).toMatchObject({ byteSize: 1_024, approvalStatus: 'pending' });
    expect(storageState.markCalls).toEqual([
      { id: DOC, size: 1_024, uploadedBy: expect.any(String) },
    ]);
  });
});
