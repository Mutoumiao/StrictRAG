/**
 * 目标：reindex 入队必须让 worker 物化新 indexVersion——api 侧不得复用旧 version、不得改写 ready/version 或假装已抬版本。
 * 需求：剧本 AA6 · prds/10-delivery/03-acceptance-scenarios.md · ADR-053 / ADR-038
 * 被测：POST /api/v1/documents/:docId/reindex · services/queue.js 载荷
 * 简介：入队载荷 stage=chunk 且无 indexVersion（新版本由 worker chunk 抬 N+1，见 worker `reindex-atomic-switch`）；
 *       api 不写文档 version / ready 位；响应 DTO 不含 indexVersion。检索用新切块的真值在 worker + corpus 装载。
 */

import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const DOC = '01900000-0000-7000-8000-0000000000d9';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

/** 已双就绪并上架的文档：indexVersion=1 正在跑 */
const docRow = {
  id: DOC,
  kbId: KB,
  tenantId: TENANT,
  title: 'policy.md',
  objectKey: `kb/${KB}/${DOC}`,
  contentType: 'text/markdown',
  chunkStrategy: 'structure_paragraph',
  approvalStatus: 'approved',
  status: 'ready',
  lifecycle: 'active',
  indexVersion: 1,
  activeIndexVersion: 1,
  embedReady: 1,
  esReady: 1,
  byteSize: 1_024,
};

const writeState = { strategyWrites: [] as string[], enqueue: [] as unknown[] };

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => (id === DOC ? { ...docRow } : null),
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    setChunkStrategy: async (_id: string, code: string) => {
      writeState.strategyWrites.push(code);
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: unknown) => {
    writeState.enqueue.push(data);
    return 'job-reindex-aa6';
  },
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

async function reindex(body: Record<string, unknown> = {}) {
  const app = buildApp();
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['super_admin'],
    tenantId: TENANT,
  });
  return app.request(`/api/v1/documents/${DOC}/reindex`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${pair.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  writeState.strategyWrites = [];
  writeState.enqueue = [];
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

describe('剧本 AA6 · reindex 的新 indexVersion 由 worker 抬', () => {
  it('入队载荷 stage=chunk 且不带 indexVersion；api 不改文档 version / ready 位', async () => {
    const res = await reindex({ chunkStrategy: 'structure_paragraph' });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Record<string, unknown> };
    expect(body.data).toMatchObject({
      docId: DOC,
      enqueued: true,
      jobId: 'job-reindex-aa6',
      stage: 'chunk',
      chunkStrategy: 'structure_paragraph',
      strategyChanged: false,
    });
    // 不得假装已抬版本（新 indexVersion 只有 worker 双就绪时才存在）
    expect(Object.keys(body.data)).not.toContain('indexVersion');

    expect(writeState.enqueue).toEqual([
      { docId: DOC, kbId: KB, tenantId: TENANT, stage: 'chunk' },
    ]);
    const payload = writeState.enqueue[0] as Record<string, unknown>;
    // 复用旧 version 会跳过重分块（idempotency resume_embed）→ 必须不带 indexVersion
    expect(Object.keys(payload).sort()).toEqual(['docId', 'kbId', 'stage', 'tenantId']);
    expect(payload.indexVersion).toBeUndefined();

    // api 侧未动版本与就绪位：旧 version 仍活跃，检索不会被半套污染
    expect(docRow.indexVersion).toBe(1);
    expect(docRow.activeIndexVersion).toBe(1);
    expect(docRow.embedReady).toBe(1);
    expect(docRow.esReady).toBe(1);
    expect(writeState.strategyWrites).toEqual([]);
  });
});
