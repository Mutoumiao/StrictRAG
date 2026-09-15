/**
 * 目标：分片策略 PATCH 有 diff 必须落服务端修改日志，无 diff 不得落；且旧文档版本与参数快照不得被改。
 * 需求：prds/00-product/05-frontend-ia.md §2.2 · 功能表 §4.2 / §4.5 · 剧本 AA1
 * 被测：createChunkStrategyRoutes PATCH · applyKbChunkStrategyPatch diff
 * 简介：复用 KB 设置审计表（不新建表）；只动 kb_chunk_strategies，不碰 documents。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB = '01900000-0000-7000-8000-000000000099';
const TENANT = '01900000-0000-7000-8000-000000000001';

const docWrites = vi.hoisted(() => ({
  setChunkStrategy: vi.fn(),
  markCompletePending: vi.fn(),
}));

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, name: 'Demo' } : null),
    setChunkStrategy: docWrites.setChunkStrategy,
    markCompletePending: docWrites.markCompletePending,
  },
}));

const {
  createMemoryChunkStrategyCatalogRepo,
  setChunkStrategyCatalogRepoForTest,
} = await import('../../src/services/chunk-strategy-catalog.js');
const {
  createMemoryKbSettingsAuditRepo,
} = await import('../../src/services/kb-settings-audit.js');
const { createChunkStrategyRoutes } = await import('../../src/routes/chunk-strategies.js');

const auditRows: Array<{ actorUserId: string; diff: Record<string, unknown> }> = [];

async function token(roles: string[] = ['kb_admin']) {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp() {
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
          auditRows.push({ actorUserId: row.actorUserId, diff: row.diff });
          return repo.insert(row);
        },
        listByKb: (kbId) => repo.listByKb(kbId),
      },
    }),
  );

  const patch = async (items: unknown, accessToken: string) => {
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/chunk-strategies`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return res;
  };
  return { patch };
}

describe('分片策略保存写服务端修改日志', () => {
  afterEach(() => {
    setChunkStrategyCatalogRepoForTest(null);
    auditRows.length = 0;
    docWrites.setChunkStrategy.mockClear();
    docWrites.markCompletePending.mockClear();
  });

  it('启用状态有 diff → 落一条修改日志，记操作者与旧→新', async () => {
    const { userId, accessToken } = await token();
    const { patch } = buildApp();
    const res = await patch(
      [{ code: 'structure_paragraph', enabled: false }],
      accessToken,
    );
    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.actorUserId).toBe(userId);
    expect(auditRows[0]?.diff).toEqual({
      'chunkStrategy.structure_paragraph.enabled': { from: true, to: false },
    });
  });

  it('同值保存无 diff → 不落修改日志', async () => {
    const { accessToken } = await token();
    const { patch } = buildApp();
    const res = await patch(
      [{ code: 'structure_paragraph', enabled: true }],
      accessToken,
    );
    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(0);
  });

  it('contextMode 有 diff → 记 paramOverrides 旧→新，且不碰文档版本与快照', async () => {
    const { accessToken } = await token();
    const { patch } = buildApp();
    const res = await patch(
      [
        {
          code: 'structure_paragraph',
          enabled: true,
          paramOverrides: { contextMode: 'l0_template' },
        },
      ],
      accessToken,
    );
    expect(res.status).toBe(200);
    expect(auditRows).toHaveLength(1);
    expect(auditRows[0]?.diff).toEqual({
      'chunkStrategy.structure_paragraph.paramOverrides': {
        from: null,
        to: { contextMode: 'l0_template' },
      },
    });
    expect(docWrites.setChunkStrategy).not.toHaveBeenCalled();
    expect(docWrites.markCompletePending).not.toHaveBeenCalled();
  });

  it('非法 PATCH → 400 且不落修改日志', async () => {
    const { accessToken } = await token();
    const { patch } = buildApp();
    const res = await patch([{ code: 'not_a_strategy', enabled: true }], accessToken);
    expect(res.status).toBe(400);
    expect(auditRows).toHaveLength(0);
  });
});
