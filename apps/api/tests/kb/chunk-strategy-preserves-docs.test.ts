/**
 * 目标：保存分片策略不得改动既有文档的 chunk 边界、index_version 与参数快照。
 * 需求：剧本 AA1 · ADR-053（旧文档不自动切策略）
 * 被测：createChunkStrategyRoutes PATCH / applyKbChunkStrategyPatch
 * 简介：以文档 + chunk 数据夹具为唯一「被改即变红」的对象；PATCH 后逐字段深等；
 *       同时给正向对照（策略行与审计确已变），避免「什么都没做」的假绿。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB = '01900000-0000-7000-8000-000000000098';
const DOC = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

/** 既有文档与其 chunk 边界：保存策略后必须逐字段不变 */
const fixture = {
  doc: {
    id: DOC,
    kbId: KB,
    indexVersion: 3,
    status: 'ready',
    chunkStrategy: 'structure_paragraph',
    chunkStrategyParams: { chunkTokens: 256, chunkOverlap: 32, contextMode: 'l0_template' },
  },
  chunks: [
    { id: 'c-old-1', docId: DOC, indexVersion: 3, ordinal: 0, bodyText: '第一段正文' },
    { id: 'c-old-2', docId: DOC, indexVersion: 3, ordinal: 1, bodyText: '第二段正文' },
  ],
};

const docWrites = vi.hoisted(() => ({
  calls: [] as string[],
}));

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, name: 'Demo' } : null),
    // 任何文档写仓被调用都会改夹具 → 断言「夹具未变」即变红
    setChunkStrategy: async (docId: string, code: string, params: Record<string, unknown>) => {
      docWrites.calls.push('setChunkStrategy');
      fixture.doc.chunkStrategy = code;
      fixture.doc.chunkStrategyParams = params;
      return docId;
    },
    patchMeta: async (docId: string, patch: Record<string, unknown>) => {
      docWrites.calls.push('patchMeta');
      Object.assign(fixture.doc, patch);
      return docId;
    },
    setIndexVersion: async (docId: string, indexVersion: number) => {
      docWrites.calls.push('setIndexVersion');
      fixture.doc.indexVersion = indexVersion;
      for (const chunk of fixture.chunks) chunk.indexVersion = indexVersion;
      return docId;
    },
    markCompletePending: async (docId: string) => {
      docWrites.calls.push('markCompletePending');
      return docId;
    },
  },
}));

const {
  createMemoryChunkStrategyCatalogRepo,
  setChunkStrategyCatalogRepoForTest,
} = await import('../../src/services/chunk-strategy-catalog.js');
const { createMemoryKbSettingsAuditRepo } = await import('../../src/services/kb-settings-audit.js');
const { createChunkStrategyRoutes } = await import('../../src/routes/chunk-strategies.js');

const auditRows: Array<{ diff: Record<string, unknown> }> = [];

async function token(roles: string[] = ['kb_admin']) {
  const pair = await issueTokenPair({ userId: uuidv7(), app: 'admin', roles, tenantId: TENANT });
  return pair.accessToken;
}

function buildApp() {
  const catalog = createMemoryChunkStrategyCatalogRepo({
    kbId: KB,
    enabled: [
      {
        code: 'structure_paragraph',
        enabled: true,
        recommendedFamilies: ['md', 'txt', 'docx', 'pdf_text'],
        paramOverrides: { chunkTokens: 256, chunkOverlap: 32, contextMode: 'l0_template' },
      },
    ],
  });
  setChunkStrategyCatalogRepoForTest(catalog);

  const repo = createMemoryKbSettingsAuditRepo();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createChunkStrategyRoutes({
      resolveKbMember: async () => true,
      auditRepo: {
        insert: async (row) => {
          auditRows.push({ diff: row.diff as Record<string, unknown> });
          return repo.insert(row);
        },
        listByKb: (kbId) => repo.listByKb(kbId),
      },
    }),
  );

  const patch = (items: unknown, accessToken: string) =>
    app.request(`/api/v1/knowledge-bases/${KB}/chunk-strategies`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });

  return { patch, catalog };
}

describe('保存分片策略不动既有文档（剧本 AA1 数据级）', () => {
  afterEach(() => {
    setChunkStrategyCatalogRepoForTest(null);
    auditRows.length = 0;
    docWrites.calls.length = 0;
  });

  it('改 KB 策略参数后：文档 index_version、chunk 边界与参数快照逐字段不变', async () => {
    const accessToken = await token();
    const { patch, catalog } = buildApp();
    const before = structuredClone(fixture);

    const res = await patch(
      [
        {
          code: 'structure_paragraph',
          enabled: true,
          paramOverrides: { chunkTokens: 512, chunkOverlap: 64, contextMode: 'l0_template' },
        },
      ],
      accessToken,
    );

    expect(res.status).toBe(200);

    // 正向对照：策略行确已变（否则本测例会是「什么都没做」的假绿）
    const rows = await catalog.listKbStrategies(KB);
    expect(rows.find((r) => r.code === 'structure_paragraph')?.paramOverrides).toMatchObject({
      chunkTokens: 512,
      chunkOverlap: 64,
    });
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.diff).toHaveProperty('chunkStrategy.structure_paragraph.paramOverrides');

    // 数据级：既有文档与 chunk 边界一字未动
    expect(fixture).toEqual(before);
    expect(docWrites.calls).toEqual([]);
  });

  it('停用策略后：既有文档的 index_version 与 chunk 边界仍不变', async () => {
    const accessToken = await token();
    const { patch, catalog } = buildApp();
    const before = structuredClone(fixture);

    const res = await patch([{ code: 'structure_paragraph', enabled: false }], accessToken);
    expect(res.status).toBe(200);
    expect((await catalog.listKbStrategies(KB))[0]?.enabled).toBe(false);

    expect(fixture).toEqual(before);
    expect(docWrites.calls).toEqual([]);
  });

  it('无 diff 保存：不落审计，同样不动既有文档', async () => {
    const accessToken = await token();
    const { patch } = buildApp();
    const before = structuredClone(fixture);

    const res = await patch(
      [
        {
          code: 'structure_paragraph',
          enabled: true,
          paramOverrides: { chunkTokens: 256, chunkOverlap: 32, contextMode: 'l0_template' },
        },
      ],
      accessToken,
    );
    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(0);

    expect(fixture).toEqual(before);
    expect(docWrites.calls).toEqual([]);
  });
});
