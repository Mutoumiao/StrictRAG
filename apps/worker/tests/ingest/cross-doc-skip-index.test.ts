/**
 * 目标：同 KB 近重复块须 skip_index 不进 manifest，报告写出冲突对；全 skip 不得 ready。
 * 需求：prds/04-pipelines/01-offline-ingest.md §5 · 功能表 §4.3 / §6
 * 被测：runIngestStage chunk
 * 简介：默认 skip_index；跨 KB 不比；archived 不挡替代文。无 pending_review。
 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
  ingestReports,
} from '@strict-rag/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';

const DUP =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';
const NEAR =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理！';
const UNIQUE =
  '差旅报销须在返程后五个工作日内提交发票与行程单，逾期不予受理。本条用于保留可索引块。';

const CURRENT = '01900000-0000-7000-8000-0000000000d1';
const OTHER = '01900000-0000-7000-8000-0000000000d2';
const OTHER_CHUNK = '01900000-0000-7000-8000-0000000000c2';
const KB = '01900000-0000-7000-8000-0000000000aa';
const OTHER_KB = '01900000-0000-7000-8000-0000000000ab';
const TENANT = '01900000-0000-7000-8000-0000000000t1';

type MemDoc = {
  id: string;
  tenantId: string;
  kbId: string;
  title: string;
  objectKey: string | null;
  contentType: string | null;
  approvalStatus: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  parsedText: string | null;
  extractMethod: string | null;
  mongoDocId: string | null;
  chunkStrategy: string | null;
  indexVersion: number;
  embedReady: number;
  esReady: number;
  lifecycle: string;
};

type MemState = {
  doc: MemDoc;
  docs: MemDoc[];
  chunks: Array<Record<string, unknown>>;
  manifests: Array<Record<string, unknown>>;
  embeddings: Array<Record<string, unknown>>;
  reports: Array<Record<string, unknown>>;
};

const workerEnv = {
  APP_ENV: 'test',
  LOG_LEVEL: 'silent',
  INGEST_SCAN_MODE: 'mock_clean',
  INGEST_MIN_EXTRACTED_CHARS: 40,
  INGEST_EMBED_MODE: 'mock',
  INGEST_ES_MODE: 'mock',
  MONGODB_URL: '',
  GATEWAY_BASE_URL: '',
  GATEWAY_API_KEY: '',
  GATEWAY_EMBED_MODEL: 'text-embedding-3-small',
  ELASTICSEARCH_URL: '',
};

const harness = { state: null as MemState | null, db: null as ReturnType<typeof createMemDb> | null };

function asRows(rows: unknown[]) {
  const p = Promise.resolve(rows);
  return Object.assign(p, { limit: async () => rows.slice(0, 1) });
}

function createMemDb(state: MemState) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === documents) return asRows(state.docs);
          if (table === chunkManifests) return asRows(state.manifests);
          if (table === chunkEmbeddings) return asRows(state.embeddings);
          if (table === chunks) return asRows(state.chunks);
          if (table === ingestReports) return asRows(state.reports);
          return asRows([]);
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if (table === documents) Object.assign(state.doc, patch);
          if (table === ingestReports && state.reports[0]) {
            Object.assign(state.reports[0], patch);
          }
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (row: Record<string, unknown>) => {
        if (table === chunks) state.chunks.push(row);
        else if (table === chunkManifests) state.manifests.push(row);
        else if (table === chunkEmbeddings) state.embeddings.push(row);
        else if (table === ingestReports) state.reports.push(row);
      },
    }),
  };
}

function seedCurrent(parsedText: string): MemDoc {
  return {
    id: CURRENT,
    tenantId: TENANT,
    kbId: KB,
    title: '新制度',
    objectKey: 'kb/x/current.txt',
    contentType: 'text/plain',
    approvalStatus: 'approved',
    status: 'parsed',
    errorCode: null,
    errorMessage: null,
    parsedText,
    extractMethod: 'utf8',
    mongoDocId: null,
    chunkStrategy: 'structure_paragraph',
    indexVersion: 0,
    embedReady: 0,
    esReady: 0,
    lifecycle: 'draft',
  };
}

function seedOther(overrides: Partial<MemDoc> = {}): MemDoc {
  return {
    id: OTHER,
    tenantId: TENANT,
    kbId: KB,
    title: '旧制度',
    objectKey: 'kb/x/other.txt',
    contentType: 'text/plain',
    approvalStatus: 'approved',
    status: 'ready',
    errorCode: null,
    errorMessage: null,
    parsedText: DUP,
    extractMethod: 'utf8',
    mongoDocId: null,
    chunkStrategy: 'structure_paragraph',
    indexVersion: 1,
    embedReady: 1,
    esReady: 1,
    lifecycle: 'active',
    ...overrides,
  };
}

vi.mock('../../src/env.js', () => ({ env: workerEnv }));
vi.mock('../../src/db.js', () => ({ getDb: () => harness.db }));
vi.mock('../../src/ingest/job-ledger.js', () => ({
  recordStageStart: async () => 'ledger-xdoc',
  recordStageEnd: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function chunkJob(): IngestJobData {
  return { docId: CURRENT, kbId: KB, tenantId: TENANT, stage: 'chunk' };
}

function boot(parsedText: string, other: MemDoc, otherChunks: Array<Record<string, unknown>>) {
  const current = seedCurrent(parsedText);
  const state: MemState = {
    doc: current,
    docs: [current, other],
    chunks: otherChunks,
    manifests: [],
    embeddings: [],
    reports: [],
  };
  harness.state = state;
  harness.db = createMemDb(state);
  return state;
}

describe('同 KB 跨文档 skip_index', () => {
  beforeEach(() => {
    harness.state = null;
    harness.db = null;
  });

  it('近重复块不进 manifest，报告可读冲突对', async () => {
    const state = boot(`${NEAR}\n\n${UNIQUE}`, seedOther(), [
      { id: OTHER_CHUNK, kbId: KB, docId: OTHER, bodyText: DUP, indexVersion: 1 },
    ]);
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBeUndefined();
    expect(result.next?.stage).toBe('embed');
    expect(state.manifests).toHaveLength(1);
    const ids = (state.manifests[0] as { chunkIds: string[] }).chunkIds;
    expect(ids).toHaveLength(1);
    expect(state.reports[0]).toMatchObject({
      crossDocDropped: 1,
      internalDropped: 0,
      chunkCount: 1,
    });
    const pairs = (state.reports[0] as { conflictPairs: Array<{ otherDocId: string }> }).conflictPairs;
    expect(pairs).toEqual([
      { otherDocId: OTHER, otherChunkId: OTHER_CHUNK, action: 'skip_index' },
    ]);
  });

  it('全部近重复则 EMPTY_CHUNKS 且不得继续 embed', async () => {
    const state = boot(NEAR, seedOther(), [
      { id: OTHER_CHUNK, kbId: KB, docId: OTHER, bodyText: DUP, indexVersion: 1 },
    ]);
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBe('EMPTY_CHUNKS');
    expect(result.next).toBeUndefined();
    expect(state.manifests).toHaveLength(0);
    expect(state.doc.status).toBe('failed');
    expect(state.reports[0]).toMatchObject({
      chunkCount: 0,
      crossDocDropped: 1,
      dualReady: 0,
    });
  });

  it('跨 KB 不比', async () => {
    const state = boot(NEAR, seedOther({ kbId: OTHER_KB }), [
      { id: OTHER_CHUNK, kbId: OTHER_KB, docId: OTHER, bodyText: DUP, indexVersion: 1 },
    ]);
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBeUndefined();
    expect((state.manifests[0] as { chunkIds: string[] }).chunkIds.length).toBeGreaterThan(0);
    expect(state.reports[0]).toMatchObject({ crossDocDropped: 0, conflictPairs: [] });
  });

  it('archived 旧文不挡后文索引', async () => {
    const state = boot(NEAR, seedOther({ lifecycle: 'archived' }), [
      { id: OTHER_CHUNK, kbId: KB, docId: OTHER, bodyText: DUP, indexVersion: 1 },
    ]);
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBeUndefined();
    expect(state.reports[0]).toMatchObject({ crossDocDropped: 0 });
  });
});
