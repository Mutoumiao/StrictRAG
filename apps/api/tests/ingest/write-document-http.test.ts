/**
 * 目标：在线编写必须落 Markdown 对象并进 pending，不得入队 scan。
 * 需求：功能表 §4.3 在线编写 · 剧本 V7 最小 · 工单「在线编写最小闭环」
 * 被测：POST /knowledge-bases/:kbId/documents/write
 * 简介：sourceType=write；空白拒；未实现策略 400 且不落库；可带部门两字段。无 BlockNote。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

type DocRow = {
  id: string;
  kbId: string;
  tenantId: string;
  title: string;
  objectKey: string;
  objectBucket: string;
  contentType: string;
  sourceType: string;
  approvalStatus: string;
  status: string;
  byteSize: number | null;
  chunkStrategy: string | null;
  ownerDeptId: string | null;
  visibilityLevel: number;
  aclPrincipals: string[] | null;
};

const docs = new Map<string, DocRow>();
const putCalls: Array<{ key: string; text: string; contentType: string }> = [];
const enqueued: string[] = [];

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getKb: async (id: string) =>
      id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null,
    insertUploadedDoc: async (input: {
      id: string;
      tenantId: string;
      kbId: string;
      title: string;
      objectBucket: string;
      objectKey: string;
      contentType: string;
      sourceType?: string;
    }) => {
      docs.set(input.id, {
        id: input.id,
        kbId: input.kbId,
        tenantId: input.tenantId,
        title: input.title,
        objectKey: input.objectKey,
        objectBucket: input.objectBucket,
        contentType: input.contentType,
        sourceType: input.sourceType ?? 'upload',
        approvalStatus: 'none',
        status: 'uploaded',
        byteSize: null,
        chunkStrategy: null,
        ownerDeptId: null,
        visibilityLevel: 20,
        aclPrincipals: null,
      });
      return input.id;
    },
    getDoc: async (id: string) => docs.get(id) ?? null,
    patchMeta: async (
      id: string,
      patch: {
        ownerDeptId?: string | null;
        visibilityLevel?: number;
        aclPrincipals?: string[] | null;
      },
    ) => {
      const row = docs.get(id);
      if (!row) return;
      if (patch.ownerDeptId !== undefined) row.ownerDeptId = patch.ownerDeptId;
      if (patch.visibilityLevel !== undefined) row.visibilityLevel = patch.visibilityLevel;
      if (patch.aclPrincipals !== undefined) row.aclPrincipals = patch.aclPrincipals;
    },
    markCompletePending: async (
      id: string,
      size: number,
      opts?: { chunkStrategy?: string },
    ) => {
      const row = docs.get(id);
      if (!row) return;
      row.byteSize = size;
      row.approvalStatus = 'pending';
      if (opts?.chunkStrategy) row.chunkStrategy = opts.chunkStrategy;
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async () => {
    enqueued.push('scan');
    return 'job-should-not-exist';
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    createUploadSlot: (kbId: string, docId: string, contentType: string) => ({
      bucket: 'strict-rag',
      key: `kb/${kbId}/docs/${docId}/obj`,
      contentType,
      uploadUrl: `/api/v1/internal/objects?key=kb/${kbId}/docs/${docId}/obj`,
      method: 'PUT' as const,
    }),
    putObject: async (key: string, body: Buffer, contentType: string) => {
      putCalls.push({ key, text: body.toString('utf8'), contentType });
      return { key, byteSize: body.byteLength, checksumSha256: 'x', bucket: 'strict-rag', contentType };
    },
    headObject: async (key: string) => {
      const hit = putCalls.find((p) => p.key === key);
      return hit ? { byteSize: Buffer.byteLength(hit.text, 'utf8') } : null;
    },
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

describe('在线编写 HTTP', () => {
  beforeEach(() => {
    docs.clear();
    putCalls.length = 0;
    enqueued.length = 0;
    useCatalog(['structure_paragraph']);
  });
  afterEach(() => {
    setChunkStrategyCatalogRepoForTest(null);
  });

  it('合法 Markdown → 201 pending + sourceType=write，写入对象且不入队 scan', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/write`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '差旅标准',
        markdown: '# 差旅\n\n住宿上限 500 元。',
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      ok: boolean;
      data: {
        docId: string;
        approvalStatus: string;
        status: string;
        sourceType: string;
        chunkStrategy: string;
      };
    };
    expect(json.ok).toBe(true);
    expect(json.data.approvalStatus).toBe('pending');
    expect(json.data.status).toBe('uploaded');
    expect(json.data.sourceType).toBe('write');
    expect(json.data.chunkStrategy).toBe('structure_paragraph');
    expect(putCalls).toHaveLength(1);
    expect(putCalls[0]?.contentType).toBe('text/markdown');
    expect(putCalls[0]?.text).toContain('住宿上限');
    expect(docs.get(json.data.docId)?.sourceType).toBe('write');
    expect(enqueued).toEqual([]);
  });

  it('空白正文 400，不写对象', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/write`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: '空', markdown: '   \n  ' }),
    });
    expect(res.status).toBe(400);
    expect(putCalls).toHaveLength(0);
    expect(docs.size).toBe(0);
  });

  it('显式未实现策略 → 400，不入队 scan', async () => {
    const app = buildApp();
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/write`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '未实现策略',
        markdown: '# 正文足够长了吧这是制度段落',
        chunkStrategy: 'heading_sections',
      }),
    });
    expect(res.status).toBe(400);
    expect(enqueued).toEqual([]);
    expect(putCalls).toHaveLength(0);
    expect(docs.size).toBe(0);
  });

  it('带 ownerDeptId / visibilityLevel → patchMeta 落库', async () => {
    const app = buildApp();
    const dept = '01900000-0000-7000-8000-0000000000de';
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/documents/write`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await token()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: '差旅标准',
        markdown: '# 差旅\n\n住宿上限 500 元。',
        ownerDeptId: dept,
        visibilityLevel: 30,
      }),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { ok: boolean; data: { docId: string } };
    expect(json.ok).toBe(true);
    expect(docs.get(json.data.docId)?.ownerDeptId).toBe(dept);
    expect(docs.get(json.data.docId)?.visibilityLevel).toBe(30);
    expect(enqueued).toEqual([]);
  });
});
