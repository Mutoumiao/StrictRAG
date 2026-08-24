/**
 * 目标：mock_clean 须从 scanning 走到双就绪 ready，且不得当成感染。
 * 需求：剧本 M3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-039
 * 被测：runIngestStage（scan→parse→chunk→embed→es_index）
 * 简介：默认 mock ES 驱动阶段链；≠ 生产扫描 / ≠ 真杀毒。
 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
} from '@strict-rag/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockEsStore } from '../../src/ingest/es-store.js';
import type { IngestJobData } from '../../src/queues.js';

const CLEAN_TEXT =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。本条用于 mock 全链走通。';

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
  chunks: Array<Record<string, unknown>>;
  manifests: Array<Record<string, unknown>>;
  embeddings: Array<Record<string, unknown>>;
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

const harness = {
  state: null as MemState | null,
  db: null as ReturnType<typeof createMemDb> | null,
  objectBytes: Buffer.from(CLEAN_TEXT, 'utf8'),
  deletedKeys: [] as string[],
};

function asRows(rows: unknown[]) {
  const p = Promise.resolve(rows);
  return Object.assign(p, { limit: async () => rows });
}

function createMemDb(state: MemState) {
  return {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === documents) return asRows([state.doc]);
          if (table === chunkManifests) return asRows(state.manifests);
          if (table === chunkEmbeddings) return asRows(state.embeddings);
          if (table === chunks) return asRows(state.chunks);
          return asRows([]);
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if (table === documents) Object.assign(state.doc, patch);
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: async (row: Record<string, unknown>) => {
        if (table === chunks) state.chunks.push(row);
        else if (table === chunkManifests) state.manifests.push(row);
        else if (table === chunkEmbeddings) state.embeddings.push(row);
      },
    }),
  };
}

function seedDoc(): MemDoc {
  return {
    id: 'doc-m3-clean',
    tenantId: 'tenant-m3',
    kbId: 'kb-m3',
    title: '请假制度',
    objectKey: 'kb/m3/doc-m3-clean.txt',
    contentType: 'text/plain',
    approvalStatus: 'approved',
    status: 'uploaded',
    errorCode: null,
    errorMessage: null,
    parsedText: null,
    extractMethod: null,
    mongoDocId: null,
    chunkStrategy: 'structure_paragraph',
    indexVersion: 0,
    embedReady: 0,
    esReady: 0,
    lifecycle: 'draft',
  };
}

vi.mock('../../src/env.js', () => ({ env: workerEnv }));
vi.mock('../../src/db.js', () => ({ getDb: () => harness.db }));
vi.mock('../../src/ingest/job-ledger.js', () => ({
  recordStageStart: async () => 'ledger-m3',
  recordStageEnd: async () => undefined,
}));
vi.mock('../../src/ingest/object-store.js', () => ({
  readObjectBytes: async () => harness.objectBytes,
  deleteObject: async (_cfg: unknown, objectKey: string | null) => {
    if (objectKey) harness.deletedKeys.push(objectKey);
  },
  storeConfigFromEnv: () => ({ mode: 'local', localDir: '.', bucket: 't' }),
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function baseJob(stage: IngestJobData['stage'], indexVersion?: number): IngestJobData {
  return {
    docId: 'doc-m3-clean',
    kbId: 'kb-m3',
    tenantId: 'tenant-m3',
    stage,
    ...(indexVersion != null ? { indexVersion } : {}),
  };
}

async function runChain(start: IngestJobData) {
  const stages: IngestJobData['stage'][] = [];
  let job = start;
  let last = await runIngestStage(job);
  stages.push(job.stage);
  for (let i = 0; i < 8 && last.next; i++) {
    job = last.next;
    last = await runIngestStage(job);
    stages.push(job.stage);
  }
  return { stages, last };
}

describe('剧本 M3 · mock_clean 阶段链（≠ 生产扫描 / ≠ 真杀毒）', () => {
  beforeEach(() => {
    expect(CLEAN_TEXT.length).toBeGreaterThanOrEqual(workerEnv.INGEST_MIN_EXTRACTED_CHARS);
    const state: MemState = {
      doc: seedDoc(),
      chunks: [],
      manifests: [],
      embeddings: [],
    };
    harness.state = state;
    harness.db = createMemDb(state);
    harness.objectBytes = Buffer.from(CLEAN_TEXT, 'utf8');
    harness.deletedKeys = [];
    mockEsStore.reset();
  });

  afterEach(() => {
    mockEsStore.reset();
  });

  it('scan 在 mock_clean 下放行 parse，不当 infected', async () => {
    const result = await runIngestStage(baseJob('scan'));
    expect(result.errorCode).toBeUndefined();
    expect(result.next?.stage).toBe('parse');
    expect(harness.state?.doc.status).toBe('scanning');
    expect(harness.state?.doc.errorCode).not.toBe('MALWARE');
    expect(harness.deletedKeys).toEqual([]);
  });

  it('mock_clean：scan→parse→chunk→embed→es_index 双就绪 ready 且 lifecycle=draft', async () => {
    const { stages, last } = await runChain(baseJob('scan'));
    expect(stages).toEqual(['scan', 'parse', 'chunk', 'embed', 'es_index']);
    expect(last.done).toBe(true);
    expect(last.errorCode).toBeUndefined();
    expect(last.next).toBeUndefined();

    const doc = harness.state!.doc;
    expect(doc.status).toBe('ready');
    expect(doc.lifecycle).toBe('draft');
    expect(doc.embedReady).toBe(1);
    expect(doc.esReady).toBe(1);
    expect(doc.errorCode).toBeNull();
    expect(harness.state!.manifests).toHaveLength(1);
    expect((harness.state!.manifests[0] as { frozen: number }).frozen).toBe(1);
    expect(harness.state!.chunks.length).toBeGreaterThan(0);
    expect(workerEnv.INGEST_ES_MODE).toBe('mock');
    expect(workerEnv.INGEST_SCAN_MODE).toBe('mock_clean');
    expect(harness.deletedKeys).toEqual([]);
  });
});
