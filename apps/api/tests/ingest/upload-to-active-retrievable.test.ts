/**
 * 目标：成员上传 → complete 进审批后仍不可检索；只有双就绪（status=ready ∧ lifecycle=active）才允许 ask 命中该文档。
 * 需求：剧本 A2 · P2必签 · P0 R7 · prds/04-pipelines/01-offline-ingest.md
 * 被测：POST …/documents/upload-url · PUT /internal/objects · POST …/complete · PATCH /documents/:docId/lifecycle · POST /knowledge-bases/:kbId/ask
 * 简介：complete 后文档仍 draft → ask 拒答 kb_not_ready、PATCH active 409；ready 后再 active，ask 才 answered 且 citation 指该文档。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import type { GraphDeps } from '../../src/graph/run.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { filterDocsForRetrieve } from '../../src/services/retrieve/corpus.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import type { CorpusChunk } from '../../src/services/retrieve/types.js';

const TENANT = '01900000-0000-7000-8000-000000000001';
const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC_BODY = '差旅住宿标准为每晚上限 500 元，超标须事前审批。';
const QUESTION = '差旅住宿标准';
const DIMS = 8;

type DocRow = {
  id: string;
  kbId: string;
  tenantId: string;
  title: string;
  objectBucket: string;
  objectKey: string;
  contentType: string;
  sourceType: string;
  status: string;
  approvalStatus: string;
  lifecycle: string;
  chunkStrategy: string | null;
  chunkStrategyParams: Record<string, unknown> | null;
  byteSize: number | null;
  ownerDeptId: string | null;
  aclPrincipals: string[] | null;
  docType: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
};

const fixture: { docs: Map<string, DocRow>; objects: Map<string, Buffer> } = {
  docs: new Map(),
  objects: new Map(),
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    getDoc: async (id: string) => fixture.docs.get(id) ?? null,
    listDocsByKb: async (kbId: string) =>
      [...fixture.docs.values()].filter((d) => d.kbId === kbId),
    insertUploadedDoc: async (input: {
      id?: string;
      tenantId: string;
      kbId: string;
      title: string;
      objectBucket: string;
      objectKey: string;
      contentType: string;
      sourceType?: 'upload' | 'write';
    }) => {
      const id = input.id ?? uuidv7();
      fixture.docs.set(id, {
        id,
        kbId: input.kbId,
        tenantId: input.tenantId,
        title: input.title,
        objectBucket: input.objectBucket,
        objectKey: input.objectKey,
        contentType: input.contentType,
        sourceType: input.sourceType ?? 'upload',
        status: 'uploaded',
        approvalStatus: 'none',
        lifecycle: 'draft',
        chunkStrategy: null,
        chunkStrategyParams: null,
        byteSize: null,
        ownerDeptId: null,
        aclPrincipals: null,
        docType: null,
        effectiveFrom: null,
        effectiveTo: null,
      });
      return id;
    },
    markCompletePending: async (
      id: string,
      byteSize: number,
      opts?: {
        chunkStrategy?: string;
        chunkStrategyParams?: Record<string, unknown>;
        checksumSha256?: string;
      },
    ) => {
      const d = fixture.docs.get(id);
      if (!d) return;
      d.byteSize = byteSize;
      d.approvalStatus = 'pending';
      d.status = 'uploaded';
      if (opts?.chunkStrategy !== undefined) d.chunkStrategy = opts.chunkStrategy;
      if (opts?.chunkStrategyParams !== undefined) d.chunkStrategyParams = opts.chunkStrategyParams;
    },
    setLifecycle: async (id: string, lifecycle: string) => {
      const d = fixture.docs.get(id);
      if (d) d.lifecycle = lifecycle;
    },
    patchMeta: async (id: string, patch: Partial<DocRow>) => {
      const d = fixture.docs.get(id);
      if (d) Object.assign(d, patch);
    },
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    createUploadSlot: (kbId: string, docId: string, contentType: string) => ({
      bucket: 'strict-rag',
      key: `kb/${kbId}/docs/${docId}/object`,
      contentType,
      uploadUrl: `/api/v1/internal/objects?key=${encodeURIComponent(
        `kb/${kbId}/docs/${docId}/object`,
      )}`,
      method: 'PUT',
    }),
    putObject: async (key: string, body: Buffer, contentType: string) => {
      fixture.objects.set(key, body);
      return {
        bucket: 'strict-rag',
        key,
        byteSize: body.byteLength,
        contentType,
        checksumSha256: 'f'.repeat(64),
      };
    },
    headObject: async (key: string) =>
      fixture.objects.has(key) ? { byteSize: fixture.objects.get(key)!.byteLength } : null,
    getObjectBuffer: async (key: string) => fixture.objects.get(key) ?? null,
    deleteObject: async () => undefined,
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async () => 'job-ingest-1',
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

/** 与 worker 同构的语料：只有 ready∧active 文档的正文能进检索集 */
function graphDeps(): GraphDeps {
  return {
    retrieve: (input) =>
      runRetrieve(input, {
        loadCorpus: async ({ kbId }): Promise<CorpusChunk[]> => {
          const docs = [...fixture.docs.values()].filter((d) => d.kbId === kbId);
          return filterDocsForRetrieve(docs).map((d) => {
            const text = fixture.objects.get(d.objectKey)?.toString('utf8') ?? '';
            return {
              chunkId: CHUNK,
              docId: d.id,
              title: d.title,
              text,
              preview: text.slice(0, 40),
              lifecycle: d.lifecycle,
              embedding: mockEmbedVector(text, DIMS),
            };
          });
        },
        embed: async (texts) => texts.map((t) => mockEmbedVector(t, DIMS)),
        rerank: async (_query, passages, topN) =>
          passages.map((_p, index) => ({ index, score: 1 - index / 100 })).slice(0, topN),
        esMode: 'mock',
      }),
    chat: async (purpose) => {
      if (purpose === 'generate') {
        return JSON.stringify({
          answer: '差旅住宿标准为每晚上限 500 元。',
          citations: [CHUNK],
          insufficient: false,
        });
      }
      if (purpose === 'claim_split') {
        return JSON.stringify({ claims: [{ text: '差旅住宿标准为每晚上限 500 元', chunkIds: [CHUNK] }] });
      }
      if (purpose === 'judge') {
        return JSON.stringify({ scores: [0.93] });
      }
      throw new Error(`unexpected purpose ${purpose}`);
    },
  };
}

function buildApp(opts: { members: Set<string> }) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', documentRoutes);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && opts.members.has(userId),
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
      settingsRepo: { get: async () => null, update: async () => null },
      execute: async (params) => {
        const { executeAsk } = await import('../../src/services/ask/execute.js');
        return executeAsk(params, { skipTrace: true, graphDeps: graphDeps() });
      },
      resolveOwnedSession: async () => true,
    }),
  );
  return app;
}

async function token() {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'web',
    roles: ['web_consumer'],
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

type App = ReturnType<typeof buildApp>;

/** 走完 HTTP 上传三跳：upload-url → PUT 对象 → complete（进审批） */
async function uploadAndComplete(app: App, accessToken: string) {
  const up = await app.request(`/api/v1/knowledge-bases/${KB}/documents/upload-url`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ title: '差旅制度.md', contentType: 'text/markdown' }),
  });
  expect(up.status).toBe(201);
  const upBody = (await up.json()) as {
    data: { docId: string; uploadUrl: string; objectKey: string };
  };
  const docId = upBody.data.docId;

  const put = await app.request(upBody.data.uploadUrl, {
    method: 'PUT',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'text/markdown' },
    body: DOC_BODY,
  });
  expect(put.status).toBe(200);

  const complete = await app.request(
    `/api/v1/knowledge-bases/${KB}/documents/${docId}/complete`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: '{}',
    },
  );
  expect(complete.status).toBe(200);
  const completeBody = (await complete.json()) as {
    data: { approvalStatus: string; status: string };
  };
  expect(completeBody.data.approvalStatus).toBe('pending');
  expect(completeBody.data.status).toBe('uploaded');
  return docId;
}

async function ask(app: App, accessToken: string) {
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ question: QUESTION }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as {
    data: {
      status: string;
      reason: string;
      answerKind?: string;
      answer: string;
      citations: { chunkId: string; docId: string }[];
    };
  };
}

afterEach(() => {
  fixture.docs.clear();
  fixture.objects.clear();
});

describe('上传 → 双就绪 → 可检索（A2）', () => {
  it('complete 后未就绪：PATCH active 409 且 ask 拒答 kb_not_ready', async () => {
    const { userId, accessToken } = await token();
    const app = buildApp({ members: new Set([userId]) });
    const docId = await uploadAndComplete(app, accessToken);

    const patch = await app.request(`/api/v1/documents/${docId}/lifecycle`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycle: 'active' }),
    });
    expect(patch.status).toBe(409);
    expect(((await patch.json()) as { error: { code: string } }).error.code).toBe('CONFLICT');

    const before = await ask(app, accessToken);
    expect(before.data.status).toBe('abstained');
    expect(before.data.reason).toBe('kb_not_ready');
    expect(before.data.answerKind).toBeUndefined();
    expect(before.data.citations).toEqual([]);
    // 拒答原因确为双闸：文档已入库但仍是 draft（status/approval 均未就绪）
    expect([...fixture.docs.values()]).toHaveLength(1);
    expect(filterDocsForRetrieve([...fixture.docs.values()])).toEqual([]);
  });

  it('双就绪后：成员 ask answered 且 citation 指回该上传文档', async () => {
    const { userId, accessToken } = await token();
    const app = buildApp({ members: new Set([userId]) });
    const docId = await uploadAndComplete(app, accessToken);

    // status=ready 是 worker 入库结果；api 侧不重跑 worker，此处夹具置位等价于该步已完成
    fixture.docs.get(docId)!.status = 'ready';

    const patch = await app.request(`/api/v1/documents/${docId}/lifecycle`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycle: 'active' }),
    });
    expect(patch.status).toBe(200);
    expect(((await patch.json()) as { data: { lifecycle: string } }).data.lifecycle).toBe('active');

    const hit = await ask(app, accessToken);
    expect(hit.data.status).toBe('answered');
    expect(hit.data.reason).toBe('verified');
    expect(hit.data.answerKind).toBe('knowledge');
    expect(hit.data.citations).toHaveLength(1);
    expect(hit.data.citations[0]?.docId).toBe(docId);
    expect(hit.data.citations[0]?.chunkId).toBe(CHUNK);
    expect(hit.data.answer).toContain('500');
  });
});
