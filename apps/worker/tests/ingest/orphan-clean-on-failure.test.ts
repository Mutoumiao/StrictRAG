/**
 * 目标：阶段失败必须触发该文档的孤儿清理，且清理抛错不得改变阶段结果。
 * 需求：剧本 L7 触发之一「文档 failed」· prds/01-architecture/03-storage-boundaries.md §2.4
 * 被测：runIngestStage 失败路径 → IngestStageDeps.cleanOrphans
 * 简介：embed 失败仍返回 EMBED_FAILED；清理被调用一次；清理抛错只吞掉、结果不变。
 */

import { documents } from '@strict-rag/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';

const DOC_ID = '01900000-0000-7000-8000-0000000000d9';
const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-0000000000t1';

const workerEnv = {
  APP_ENV: 'test',
  LOG_LEVEL: 'silent',
  INGEST_EMBED_MODE: 'fail',
  MONGODB_URL: '',
  GATEWAY_BASE_URL: '',
  GATEWAY_API_KEY: '',
};

const docRow: Record<string, unknown> = {
  id: DOC_ID,
  tenantId: TENANT,
  kbId: KB,
  title: 'note.txt',
  objectKey: 'kb/x/note.txt',
  contentType: 'text/plain',
  approvalStatus: 'approved',
  status: 'chunked',
  errorCode: null,
  errorMessage: null,
  parsedText: '正文',
  extractMethod: 'utf8',
  mongoDocId: null,
  chunkStrategy: 'structure_paragraph',
  chunkStrategyParams: null,
  indexVersion: 1,
  activeIndexVersion: null,
  embedReady: 0,
  esReady: 0,
  lifecycle: 'draft',
};

const harness = { db: null as unknown };

function asRows(rows: unknown[]) {
  const p = Promise.resolve(rows);
  return Object.assign(p, { limit: async () => rows.slice(0, 1) });
}

function createMemDb(row: Record<string, unknown>) {
  return {
    select: () => ({ from: (table: unknown) => ({ where: () => asRows(table === documents ? [row] : []) }) }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if (table === documents) Object.assign(row, patch);
        },
      }),
    }),
    insert: () => ({ values: async () => undefined }),
  };
}

vi.mock('../../src/env.js', () => ({ env: workerEnv }));
vi.mock('../../src/db.js', () => ({ getDb: () => harness.db }));
vi.mock('../../src/ingest/job-ledger.js', () => ({
  recordStageStart: async () => 'ledger-l7',
  recordStageEnd: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function job(): IngestJobData {
  return { docId: DOC_ID, kbId: KB, tenantId: TENANT, stage: 'embed' };
}

describe('阶段失败触发孤儿清理（剧本 L7）', () => {
  beforeEach(() => {
    harness.db = createMemDb(docRow);
    Object.assign(docRow, { status: 'chunked', errorCode: null, errorMessage: null, embedReady: 0 });
  });

  it('embed 失败：仍返回 EMBED_FAILED，并调用一次清理', async () => {
    const cleanOrphans = vi.fn(async () => ({ status: 'skipped', reason: 'no_orphan' }));

    const result = await runIngestStage(job(), { cleanOrphans });

    expect(result.errorCode).toBe('EMBED_FAILED');
    expect(docRow.status).toBe('failed');
    expect(cleanOrphans).toHaveBeenCalledTimes(1);
    expect(cleanOrphans).toHaveBeenCalledWith(DOC_ID);
  });

  it('清理自身抛错：只吞掉，阶段结果不变', async () => {
    const cleanOrphans = vi.fn(async () => {
      throw new Error('cleanup boom');
    });

    const result = await runIngestStage(job(), { cleanOrphans });

    expect(result.errorCode).toBe('EMBED_FAILED');
    expect(cleanOrphans).toHaveBeenCalledTimes(1);
  });
});
