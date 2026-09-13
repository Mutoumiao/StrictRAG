/**
 * 目标：文档替代联动必须写两列并把旧文关检索、后继升 active。
 * 需求：功能表 §4.3 / §5.2 · ADR-020 · 剧本 E2
 * 被测：evaluateSupersedeLink · POST /documents/:docId/supersede · filterDocsForRetrieve
 * 简介：PATCH lifecycle 无后继废止不在本文件；R7 主锚仍是 ready-active-corpus。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { evaluateSupersedeLink } from '../../src/services/document-supersede.js';
import { filterDocsForRetrieve } from '../../src/services/retrieve/corpus.js';

const OLD = '01900000-0000-7000-8000-0000000000d1';
const NEW = '01900000-0000-7000-8000-0000000000d2';
const OTHER = '01900000-0000-7000-8000-0000000000d3';
const KB = '01900000-0000-7000-8000-0000000000aa';
const OTHER_KB = '01900000-0000-7000-8000-0000000000ab';
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
  supersedesDocId: string | null;
  supersededByDocId: string | null;
};

function baseRow(id: string, patch: Partial<Row> = {}): Row {
  return {
    id,
    title: id === NEW ? '新版' : '旧版',
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'draft',
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
    supersedesDocId: null,
    supersededByDocId: null,
    ...patch,
  };
}

const docs = new Map<string, Row>();
const pairCalls: Array<{ oldDocId: string; successorDocId: string }> = [];

function seed() {
  docs.clear();
  docs.set(OLD, baseRow(OLD, { lifecycle: 'active' }));
  docs.set(NEW, baseRow(NEW, { lifecycle: 'draft' }));
  pairCalls.length = 0;
}

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => docs.get(id) ?? null,
    supersedePair: async (oldDocId: string, successorDocId: string) => {
      pairCalls.push({ oldDocId, successorDocId });
      const old = docs.get(oldDocId);
      const successor = docs.get(successorDocId);
      if (old) {
        docs.set(oldDocId, { ...old, lifecycle: 'superseded', supersededByDocId: successorDocId });
      }
      if (successor) {
        docs.set(successorDocId, {
          ...successor,
          lifecycle: 'active',
          supersedesDocId: oldDocId,
        });
      }
    },
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

describe('evaluateSupersedeLink', () => {
  const old = baseRow(OLD, { lifecycle: 'active' });
  const successor = baseRow(NEW, { lifecycle: 'draft' });

  it('合法：旧 active、后继 ready+draft', () => {
    expect(evaluateSupersedeLink({ old, successor, successorDocId: NEW }).ok).toBe(true);
  });

  it('自指 CONFLICT', () => {
    const r = evaluateSupersedeLink({ old, successor: old, successorDocId: OLD });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(409);
  });

  it('跨库 CONFLICT', () => {
    const r = evaluateSupersedeLink({
      old,
      successor: { ...successor, kbId: OTHER_KB },
      successorDocId: NEW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('CONFLICT');
  });

  it('后继未 ready CONFLICT', () => {
    const r = evaluateSupersedeLink({
      old,
      successor: { ...successor, status: 'parsing' },
      successorDocId: NEW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('ready');
  });

  it('旧文已有 supersededBy CONFLICT', () => {
    const r = evaluateSupersedeLink({
      old: { ...old, supersededByDocId: OTHER },
      successor,
      successorDocId: NEW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(409);
  });

  it('后继已 superseded CONFLICT', () => {
    const r = evaluateSupersedeLink({
      old,
      successor: { ...successor, lifecycle: 'superseded' },
      successorDocId: NEW,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(409);
  });

  it('旧文不存在 NOT_FOUND', () => {
    const r = evaluateSupersedeLink({ old: null, successor, successorDocId: NEW });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.httpStatus).toBe(404);
  });
});

describe('POST /documents/:docId/supersede', () => {
  afterEach(() => {
    seed();
  });

  seed();

  it('200：旧 superseded、后继 active、两列互指', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${OLD}/supersede`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ successorDocId: NEW }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        oldLifecycle: string;
        successorLifecycle: string;
        oldDocId: string;
        successorDocId: string;
      };
    };
    expect(body.data).toEqual({
      oldDocId: OLD,
      successorDocId: NEW,
      oldLifecycle: 'superseded',
      successorLifecycle: 'active',
    });
    expect(pairCalls).toEqual([{ oldDocId: OLD, successorDocId: NEW }]);
    expect(docs.get(OLD)?.lifecycle).toBe('superseded');
    expect(docs.get(OLD)?.supersededByDocId).toBe(NEW);
    expect(docs.get(NEW)?.lifecycle).toBe('active');
    expect(docs.get(NEW)?.supersedesDocId).toBe(OLD);
  });

  it('后继未 ready → 409', async () => {
    docs.set(NEW, { ...docs.get(NEW)!, status: 'parsing' });
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${OLD}/supersede`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ successorDocId: NEW }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('CONFLICT');
    expect(pairCalls).toHaveLength(0);
  });

  it('非法 body → 400', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${OLD}/supersede`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('自指 → 409', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${OLD}/supersede`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ successorDocId: OLD }),
    });
    expect(res.status).toBe(409);
    expect(pairCalls).toHaveLength(0);
  });

  it('替代后语料只留后继', async () => {
    const app = buildApp();
    const accessToken = await token();
    const res = await app.request(`/api/v1/documents/${OLD}/supersede`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ successorDocId: NEW }),
    });
    expect(res.status).toBe(200);
    const kept = filterDocsForRetrieve([...docs.values()]).map((d) => d.id);
    expect(kept).toEqual([NEW]);
  });
});
