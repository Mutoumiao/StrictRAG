/**
 * 目标：文档删除必须先 archived 再入队 purge，且不得把 PATCH 归档当成删除。
 * 需求：功能表 §5.2 · ADR-020 · 剧本 E3
 * 被测：evaluateDocumentDelete · DELETE /documents/:docId · PATCH lifecycle archived · filterDocsForRetrieve
 * 简介：PATCH archived 不入队。R7 主锚仍是 ready-active-corpus。无 PG 硬删。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { evaluateDocumentDelete } from '../../src/services/document-delete.js';
import { filterDocsForRetrieve } from '../../src/services/retrieve/corpus.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const OTHER = '01900000-0000-7000-8000-0000000000d2';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

type Row = {
  id: string;
  title: string;
  status: string;
  approvalStatus: string;
  lifecycle: string;
  byteSize: number;
  indexVersion: number;
  errorCode: null;
  embedReady: number;
  esReady: number;
  tenantId: string;
  kbId: string;
  sourceType: string;
  contentType: string;
  errorMessage: null;
  docType: null;
  createdAt: string;
  updatedAt: string;
  ownerDeptId: null;
  visibilityLevel: number;
};

function baseRow(id: string, patch: Partial<Row> = {}): Row {
  return {
    id,
    title: id === DOC ? '待删' : '保留',
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'active',
    byteSize: 12,
    indexVersion: 1,
    errorCode: null,
    embedReady: 1,
    esReady: 1,
    tenantId: TENANT,
    kbId: KB,
    sourceType: 'upload',
    contentType: 'text/plain',
    errorMessage: null,
    docType: null,
    createdAt: '2026-08-01 10:00:00',
    updatedAt: '2026-08-02 11:00:00',
    ownerDeptId: null,
    visibilityLevel: 20,
    ...patch,
  };
}

const docs = new Map<string, Row>();
const enqueued: Array<{ docId: string; stage: string }> = [];

function seed() {
  docs.clear();
  docs.set(DOC, baseRow(DOC));
  docs.set(OTHER, baseRow(OTHER, { lifecycle: 'active' }));
  enqueued.length = 0;
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => docs.get(id) ?? null,
    archiveForPurge: async (docId: string) => {
      const row = docs.get(docId);
      if (row) docs.set(docId, { ...row, lifecycle: 'archived' });
    },
    setLifecycle: async (docId: string, lifecycle: string) => {
      const row = docs.get(docId);
      if (row) docs.set(docId, { ...row, lifecycle });
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: { docId: string; stage: string }) => {
    enqueued.push({ docId: data.docId, stage: data.stage });
    return 'job-purge-1';
  },
}));

const { documentRoutes } = await import('../../src/routes/documents/index.js');

async function token() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['kb_admin'],
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

describe('evaluateDocumentDelete', () => {
  it('缺文档 404', () => {
    const r = evaluateDocumentDelete(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(404);
  });

  it('存在即 ok，含已 archived', () => {
    expect(evaluateDocumentDelete({ id: DOC }).ok).toBe(true);
  });
});

describe('DELETE /documents/:docId', () => {
  afterEach(() => {
    seed();
  });

  seed();

  it('200：archived 且入队 purge', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { docId: string; lifecycle: string; purgeEnqueued: boolean };
    };
    expect(body.data).toEqual({
      docId: DOC,
      lifecycle: 'archived',
      purgeEnqueued: true,
    });
    expect(docs.get(DOC)?.lifecycle).toBe('archived');
    expect(enqueued).toEqual([{ docId: DOC, stage: 'purge' }]);
  });

  it('缺文档 404 且不入队', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request('/api/v1/documents/01900000-0000-7000-8000-0000000000ff', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
    expect(enqueued).toHaveLength(0);
  });

  it('PATCH archived 不入队 purge', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}/lifecycle`, {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ lifecycle: 'archived' }),
    });
    expect(res.status).toBe(200);
    expect(enqueued).toHaveLength(0);
  });

  it('删除后语料不含该文', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${DOC}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const kept = filterDocsForRetrieve([...docs.values()]).map((d) => d.id);
    expect(kept).toEqual([OTHER]);
  });
});
