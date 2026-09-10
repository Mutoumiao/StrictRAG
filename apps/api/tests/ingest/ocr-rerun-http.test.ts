/**
 * 目标：卡在 OCR 闸的文档 reindex 必须入队 ocr；短 utf8 页眉与 ready 仍入队 chunk。
 * 需求：剧本 Q7 · ADR-043 · P5 历史 needs_ocr 重跑
 * 被测：POST /documents/:docId/reindex · reindexEnqueueStage
 * 简介：无新 HTTP。不自动全库。≠ 真引擎。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { reindexEnqueueStage } from '../../src/services/ingest-reindex-stage.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docState = {
  status: 'ready' as string,
  extractMethod: null as string | null,
  chunkStrategy: 'structure_paragraph' as string | null,
};

const enqueued: Array<{ docId: string; stage: string }> = [];

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
            status: docState.status,
            extractMethod: docState.extractMethod,
            byteSize: 12,
            contentType: 'application/pdf',
          }
        : null,
    setChunkStrategy: async () => undefined,
    getKb: async (id: string) =>
      id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null,
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: { docId: string; stage: string }) => {
    enqueued.push({ docId: data.docId, stage: data.stage });
    return 'job-ocr-rerun-1';
  },
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

describe('reindexEnqueueStage', () => {
  it('needs_ocr 非 utf8 文本层 → ocr；短 utf8 与 ready → chunk', () => {
    expect(reindexEnqueueStage({ status: 'needs_ocr', extractMethod: 'none' })).toBe('ocr');
    expect(reindexEnqueueStage({ status: 'needs_ocr', extractMethod: null })).toBe('ocr');
    expect(reindexEnqueueStage({ status: 'needs_ocr', extractMethod: 'pdf_text' })).toBe('ocr');
    expect(reindexEnqueueStage({ status: 'needs_review', extractMethod: 'none' })).toBe('ocr');
    expect(reindexEnqueueStage({ status: 'needs_ocr', extractMethod: 'text' })).toBe('chunk');
    expect(reindexEnqueueStage({ status: 'ready', extractMethod: 'pdf_text' })).toBe('chunk');
  });
});

describe('Q7 reindex 入队 ocr', () => {
  beforeEach(() => {
    docState.status = 'ready';
    docState.extractMethod = null;
    docState.chunkStrategy = 'structure_paragraph';
    enqueued.length = 0;
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

  async function postReindex() {
    const app = buildApp();
    const accessToken = await token();
    return app.request(`/api/v1/documents/${DOC}/reindex`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
  }

  it('needs_ocr + extractMethod none → 入队 ocr', async () => {
    docState.status = 'needs_ocr';
    docState.extractMethod = 'none';
    const res = await postReindex();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { stage: string; jobId: string } };
    expect(body.data.stage).toBe('ocr');
    expect(body.data.jobId).toBe('job-ocr-rerun-1');
    expect(enqueued).toEqual([{ docId: DOC, stage: 'ocr' }]);
  });

  it('needs_review → 入队 ocr', async () => {
    docState.status = 'needs_review';
    docState.extractMethod = 'none';
    const res = await postReindex();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { stage: string } };
    expect(body.data.stage).toBe('ocr');
    expect(enqueued[0]?.stage).toBe('ocr');
  });

  it('ready → 仍入队 chunk', async () => {
    const res = await postReindex();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { stage: string } };
    expect(body.data.stage).toBe('chunk');
    expect(enqueued).toEqual([{ docId: DOC, stage: 'chunk' }]);
  });

  it('短 utf8 needs_ocr extractMethod=text → 仍入队 chunk（Q3 不洗）', async () => {
    docState.status = 'needs_ocr';
    docState.extractMethod = 'text';
    const res = await postReindex();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { stage: string } };
    expect(body.data.stage).toBe('chunk');
    expect(enqueued[0]?.stage).toBe('chunk');
  });
});
