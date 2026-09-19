/**
 * 目标：ingest_jobs 阶段账本须记录开始/结束与失败码；阶段链 embed → es_index 与文档状态链可观测。
 * 需求：X-04 · 剧本 L5（Bull Board / ingest_jobs 可见 embedding → indexing_es → ready）
 * 被测：buildStageStartRow · buildStageEndPatch · recordStageStart · recordStageEnd · runIngestStage 接线
 * 简介：最小账本行、成功链、失败码、pipeline 接线；另跑一遍 chunk→embed→es_index 断言账本 jobName 链
 *       与 documents 状态链 chunking→embedding→indexing_es→ready。默认 mock 栈（≠ 生产 ES）。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { doc, objectStoreMock } from './_support/ingest-harness.js';
import {
  buildStageEndPatch,
  buildStageStartRow,
  ledgerJobName,
  ledgerStatusFromResult,
  recordStageEnd,
  recordStageStart,
  type StageLedgerContext,
} from '../../src/ingest/job-ledger.js';

vi.mock('../../src/ingest/failure-webhook.js', () => ({
  notifyIngestFailure: async () => undefined,
}));

// job-ledger 静态 import 会经 logger 触发 env.js mock 工厂，故夹具须在 import 前就绪
const h = await vi.hoisted(async () =>
  (await import('./_support/ingest-harness.js')).createHarness(),
);

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

const BODY =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';

function ledgerCtx(stage: string): StageLedgerContext {
  return { tenantId: 't', kbId: 'k', docId: 'd', stage };
}

describe('ledgerJobName / ledgerStatusFromResult', () => {
  it('jobName equals stage', () => {
    expect(ledgerJobName('scan')).toBe('scan');
    expect(ledgerJobName('es_index')).toBe('es_index');
  });

  it('succeeded when no errorCode', () => {
    expect(ledgerStatusFromResult({ next: { stage: 'parse' } })).toBe('succeeded');
    expect(ledgerStatusFromResult({ done: true })).toBe('succeeded');
  });

  it('failed when errorCode set', () => {
    expect(ledgerStatusFromResult({ done: true, errorCode: 'MALWARE' })).toBe('failed');
  });
});

describe('buildStageStartRow', () => {
  it('builds running row with queue default and stage payload', () => {
    const row = buildStageStartRow({
      tenantId: 't1',
      kbId: 'k1',
      docId: 'd1',
      stage: 'embed',
      indexVersion: 3,
    });
    expect(row.status).toBe('running');
    expect(row.jobName).toBe('embed');
    expect(row.queue).toBe('sr-ingest');
    expect(row.indexVersion).toBe(3);
    expect(row.payload).toEqual({ stage: 'embed' });
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });
});

describe('buildStageEndPatch', () => {
  it('success chain records nextStage', () => {
    const patch = buildStageEndPatch('scan', { next: { stage: 'parse' } });
    expect(patch.status).toBe('succeeded');
    expect(patch.errorMessage).toBeNull();
    expect(patch.payload).toEqual({ stage: 'scan', nextStage: 'parse' });
  });

  it('terminal dual-ready marks terminal', () => {
    const patch = buildStageEndPatch('es_index', { done: true }, 2);
    expect(patch.status).toBe('succeeded');
    expect(patch.indexVersion).toBe(2);
    expect(patch.payload).toEqual({ stage: 'es_index', terminal: true });
  });

  it('failure records errorCode in payload and message', () => {
    const patch = buildStageEndPatch('embed', { done: true, errorCode: 'EMBED_FAILED' });
    expect(patch.status).toBe('failed');
    expect(patch.errorMessage).toBe('EMBED_FAILED');
    expect(patch.payload).toEqual({ stage: 'embed', errorCode: 'EMBED_FAILED' });
  });
});

describe('recordStageStart / recordStageEnd (shipped writers)', () => {
  it('recordStageStart inserts built row and returns id', async () => {
    const inserted: unknown[] = [];
    const db = {
      insert: (table: unknown) => ({
        values: async (row: unknown) => {
          inserted.push({ table, row });
        },
      }),
    };
    const id = await recordStageStart(db as never, {
      tenantId: 't',
      kbId: 'k',
      docId: 'd',
      stage: 'chunk',
      indexVersion: 1,
    });
    expect(id).toBeTruthy();
    expect(inserted).toHaveLength(1);
    const row = (inserted[0] as { row: { id: string; status: string; jobName: string } }).row;
    expect(row.id).toBe(id);
    expect(row.status).toBe('running');
    expect(row.jobName).toBe('chunk');
  });

  it('recordStageStart returns null on insert throw (non-blocking)', async () => {
    const db = {
      insert: () => ({
        values: async () => {
          throw new Error('db down');
        },
      }),
    };
    const id = await recordStageStart(db as never, {
      tenantId: 't',
      kbId: 'k',
      docId: 'd',
      stage: 'scan',
    });
    expect(id).toBeNull();
  });

  it('recordStageEnd updates by id; no-op when jobId null', async () => {
    const updates: unknown[] = [];
    const db = {
      update: () => ({
        set: (patch: unknown) => ({
          where: async () => {
            updates.push(patch);
          },
        }),
      }),
    };
    await recordStageEnd(db as never, null, ledgerCtx('scan'), { next: { stage: 'parse' } });
    expect(updates).toHaveLength(0);

    await recordStageEnd(db as never, 'job-1', ledgerCtx('scan'), { next: { stage: 'parse' } });
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({ status: 'succeeded' });
  });

  it('recordStageEnd swallows update errors', async () => {
    const db = {
      update: () => ({
        set: () => ({
          where: async () => {
            throw new Error('update fail');
          },
        }),
      }),
    };
    await expect(
      recordStageEnd(db as never, 'job-1', ledgerCtx('embed'), {
        done: true,
        errorCode: 'EMBED_FAILED',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('pipeline wiring contract (static)', () => {
  it('pipeline imports recordStageStart/End from job-ledger', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const src = await fs.readFile(path.join(process.cwd(), 'src/ingest/pipeline.ts'), 'utf8');
    expect(src).toMatch(/recordStageStart/);
    expect(src).toMatch(/recordStageEnd/);
    expect(src).toMatch(/from ['"]\.\/job-ledger\.js['"]/);
  });
});

describe('阶段链与账本（剧本 L5）', () => {
  beforeEach(() => {
    h.reset();
    h.env.INGEST_ES_MODE = 'mock';
    h.env.INGEST_EMBED_MODE = 'mock';
    mockEsStore.reset();
  });

  it('账本记 chunk/embed/es_index，文档状态链 embedding → indexing_es → ready', async () => {
    const state = h.boot(
      { parsedText: BODY, status: 'parsed', extractMethod: 'text' },
      Buffer.from(BODY, 'utf8'),
    );
    const current = doc(state);
    const job = (stage: IngestJobData['stage']): IngestJobData => ({
      docId: current.id,
      kbId: current.kbId,
      tenantId: current.tenantId,
      stage,
    });

    const chunked = await runIngestStage(job('chunk'));
    const embedded = await runIngestStage(chunked.next!);
    const indexed = await runIngestStage(embedded.next!);

    expect(indexed.errorCode).toBeUndefined();
    expect(indexed.done).toBe(true);
    expect(doc(state).status).toBe('ready');

    // Bull Board / 列表可见的账本行：逻辑 stage = job 名，物理队列仍单条 sr-ingest
    expect(state.jobs.inserted.map((j) => j.jobName)).toEqual(['chunk', 'embed', 'es_index']);
    expect(state.jobs.inserted.map((j) => j.status)).toEqual(['running', 'running', 'running']);
    expect(state.jobs.inserted.map((j) => j.queue)).toEqual([
      'sr-ingest',
      'sr-ingest',
      'sr-ingest',
    ]);
    expect(state.jobs.updated.map((u) => u.status)).toEqual([
      'succeeded',
      'succeeded',
      'succeeded',
    ]);
    expect(state.jobs.updated.map((u) => u.payload)).toEqual([
      { stage: 'chunk', nextStage: 'embed' },
      { stage: 'embed', nextStage: 'es_index' },
      { stage: 'es_index', terminal: true },
    ]);

    // 文档状态链：可观测 embed 段与 ES 段，末尾才是 ready
    expect(state.statusSeq).toEqual(['chunking', 'embedding', 'indexing_es', 'ready']);
    expect(doc(state).embedReady).toBe(1);
    expect(doc(state).esReady).toBe(1);
  });
});
