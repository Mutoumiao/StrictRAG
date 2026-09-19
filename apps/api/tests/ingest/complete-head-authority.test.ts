/**
 * 目标：complete 的体积判定只认对象 Head——改前端/预签名声明都放不进来，反向也不影响合规对象通过。
 * 需求：剧本 M5 · 剧本 M6 · prds/10-delivery/03-acceptance-scenarios.md · ADR-039
 * 被测：POST …/documents/upload-url · POST …/documents/:docId/complete
 * 简介：客户端声称小体积（declaredByteSize）或 upload-url 回的 maxBytes 都不改变判定：Head 超限仍 413；
 *       反向对照：Head 合规而客户端声称超大 → 200（不采信客户端声明）。无真存储。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d6';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const MAX_BYTES = 10_000_000;

const state = {
  headBytes: MAX_BYTES + 1,
  markCalls: [] as Array<{ id: string; size: number }>,
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
    insertUploadedDoc: async () => DOC,
    markCompletePending: async (id: string, size: number) => {
      state.markCalls.push({ id, size });
    },
    patchMeta: async () => undefined,
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: state.headBytes }),
    getObjectBuffer: async () => Buffer.alloc(state.headBytes, 0x61),
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

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  return app;
}

async function token() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['super_admin'],
    tenantId: TENANT,
  });
  return pair.accessToken;
}

async function complete(body: Record<string, unknown> = {}) {
  const app = buildApp();
  return app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  state.headBytes = MAX_BYTES + 1;
  state.markCalls = [];
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

describe('剧本 M5 · 只改前端 limit 无效', () => {
  it('客户端声称小体积不改变判定：Head 超限仍 413 且不落 pending', async () => {
    const res = await complete({ declaredByteSize: 1 });

    expect(res.status).toBe(413);
    const body = (await res.json()) as { error?: { code: string } };
    expect(body.error?.code).toBe('PAYLOAD_TOO_LARGE');
    expect(state.markCalls).toEqual([]);
  });

  it('对照：Head 合规而客户端声称超大 → 200（服务端不采信客户端声明）', async () => {
    state.headBytes = 2_048;

    const res = await complete({ declaredByteSize: MAX_BYTES * 10 });

    expect(res.status).toBe(200);
    expect(state.markCalls).toEqual([{ id: DOC, size: 2_048 }]);
  });
});

describe('剧本 M6 · 预签名无 max body 能力', () => {
  it('upload-url 回的 maxBytes 只是展示值，不替代 complete 的 Head 闸', async () => {
    const app = buildApp();
    const accessToken = await token();
    const up = await app.request(`/api/v1/knowledge-bases/${KB}/documents/upload-url`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ title: 'oversize.pdf', contentType: 'application/pdf' }),
    });
    expect(up.status).toBe(201);
    const upBody = (await up.json()) as { data: { maxBytes: number } };
    expect(upBody.data.maxBytes).toBe(MAX_BYTES);

    // 客户端无视预签名提示，把对象写成超限 → complete 仍以 Head 拒
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ declaredByteSize: upBody.data.maxBytes - 1 }),
    });
    expect(res.status).toBe(413);
    expect(((await res.json()) as { error?: { code: string } }).error?.code).toBe(
      'PAYLOAD_TOO_LARGE',
    );
    expect(state.markCalls).toEqual([]);
  });
});
