/**
 * 目标：仅页眉约 20 字的全文不得 parse 成功，也不得 ready 或写出成功 manifest。
 * 需求：剧本 Q3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-043
 * 被测：runIngestStage（parse 字数闸）
 * 简介：低于 INGEST_MIN_EXTRACTED_CHARS 默认 40 → needs_ocr + NO_TEXT_LAYER；测全文过短，不测切段丢短句。
 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
} from '@strict-rag/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';

/** 约 20 字符页眉夹具，低于默认抽取下限 40 */
const HEADER_ONLY = '页眉：内部资料·机密·第1页·XX公司';

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
  objectBytes: Buffer.from(HEADER_ONLY, 'utf8'),
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
    id: 'doc-q3-header',
    tenantId: 'tenant-q3',
    kbId: 'kb-q3',
    title: '扫描件页眉',
    objectKey: 'kb/q3/header.txt',
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
  recordStageStart: async () => 'ledger-q3',
  recordStageEnd: async () => undefined,
}));
vi.mock('../../src/ingest/object-store.js', () => ({
  readObjectBytes: async () => harness.objectBytes,
  deleteObject: async () => undefined,
  storeConfigFromEnv: () => ({ mode: 'local', localDir: '.', bucket: 't' }),
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function job(stage: IngestJobData['stage']): IngestJobData {
  return {
    docId: 'doc-q3-header',
    kbId: 'kb-q3',
    tenantId: 'tenant-q3',
    stage,
  };
}

describe('剧本 Q3 · 仅页眉过短不得 parse 成功', () => {
  beforeEach(() => {
    expect(HEADER_ONLY.length).toBeGreaterThanOrEqual(18);
    expect(HEADER_ONLY.length).toBeLessThan(workerEnv.INGEST_MIN_EXTRACTED_CHARS);
    const state: MemState = {
      doc: seedDoc(),
      chunks: [],
      manifests: [],
      embeddings: [],
    };
    harness.state = state;
    harness.db = createMemDb(state);
    harness.objectBytes = Buffer.from(HEADER_ONLY, 'utf8');
  });

  afterEach(() => {
    harness.state = null;
    harness.db = null;
  });

  it('约 20 字符页眉 → needs_ocr + NO_TEXT_LAYER，不得进入 chunk/ready', async () => {
    const result = await runIngestStage(job('parse'));
    expect(result.done).toBe(true);
    expect(result.errorCode).toBe('NO_TEXT_LAYER');
    expect(result.next).toBeUndefined();

    const doc = harness.state!.doc;
    expect(doc.status).toBe('needs_ocr');
    expect(doc.errorCode).toBe('NO_TEXT_LAYER');
    expect(doc.status).not.toBe('ready');
    expect(doc.embedReady).toBe(0);
    expect(doc.esReady).toBe(0);
    expect(harness.state!.manifests).toEqual([]);
    expect(harness.state!.chunks).toEqual([]);
  });

  it('过短全文即使误入 chunk 也不得物化成功用的空/近空 manifest', async () => {
    await runIngestStage(job('parse'));
    expect(harness.state!.doc.status).toBe('needs_ocr');

    const chunkResult = await runIngestStage(job('chunk'));
    expect(chunkResult.errorCode).toBe('EMPTY_CHUNKS');
    expect(chunkResult.next).toBeUndefined();
    expect(harness.state!.manifests).toEqual([]);
    expect(harness.state!.chunks).toEqual([]);
    expect(harness.state!.doc.status).not.toBe('ready');
    expect(harness.state!.doc.status).not.toBe('chunking');
  });
});
