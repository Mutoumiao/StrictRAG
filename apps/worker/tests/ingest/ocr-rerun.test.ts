/**
 * 目标：历史 needs_ocr 入队 ocr 后须能跑到双就绪；失败不得抬 indexVersion；utf8 文本层不得用 OCR 洗 ready。
 * 需求：剧本 Q7 · ADR-043 · P5 历史 needs_ocr 重跑
 * 被测：runIngestStage ocr 重跑链
 * 简介：注入抽取器。≠ 真引擎。≠ 启动自动全库。
 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
  ingestReports,
} from '@strict-rag/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockEsStore } from '../../src/ingest/es-store.js';
import type { IngestJobData } from '../../src/queues.js';

const SCAN_PDF = Buffer.from('%PDF-\n%%EOF', 'latin1');
const OCR_TEXT =
  '请假须提前一个工作日书面申请，部门负责人签字后交人力资源部备案。未按流程提交的申请不得视为已批准。';

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
  INGEST_OCR_ENABLED: true,
  INGEST_OCR_ADR_REF: '',
  INGEST_OCR_MIN_CONFIDENCE: 0.7,
};

const harness = {
  state: null as MemState | null,
  db: null as ReturnType<typeof createMemDb> | null,
  objectBytes: SCAN_PDF,
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

function seedStuckScan(): MemDoc {
  return {
    id: 'doc-ocr-rerun',
    tenantId: 'tenant-ocr-rerun',
    kbId: 'kb-ocr-rerun',
    title: '历史扫描件',
    objectKey: 'kb/ocr/stuck.pdf',
    contentType: 'application/pdf',
    approvalStatus: 'approved',
    status: 'needs_ocr',
    errorCode: 'NO_TEXT_LAYER',
    errorMessage: 'pdf has no text layer',
    parsedText: null,
    extractMethod: 'none',
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
  recordStageStart: async () => 'ledger-ocr-rerun',
  recordStageEnd: async () => undefined,
}));
vi.mock('../../src/ingest/object-store.js', () => ({
  readObjectBytes: async () => harness.objectBytes,
  deleteObject: async () => undefined,
  storeConfigFromEnv: () => ({ mode: 'local', localDir: '.', bucket: 't' }),
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function job(stage: IngestJobData['stage'], indexVersion?: number): IngestJobData {
  return {
    docId: 'doc-ocr-rerun',
    kbId: 'kb-ocr-rerun',
    tenantId: 'tenant-ocr-rerun',
    stage,
    ...(indexVersion != null ? { indexVersion } : {}),
  };
}

async function runChain(
  start: IngestJobData,
  deps?: { ocrExtract?: () => Promise<{ text: string; confidence: number }> },
) {
  const stages: IngestJobData['stage'][] = [];
  let current = start;
  let last = await runIngestStage(current, deps);
  stages.push(current.stage);
  for (let i = 0; i < 8 && last.next; i++) {
    current = last.next;
    last = await runIngestStage(current, deps);
    stages.push(current.stage);
  }
  return { stages, last };
}

describe('Q7 历史 needs_ocr 重跑', () => {
  beforeEach(() => {
    workerEnv.INGEST_OCR_ENABLED = true;
    const state: MemState = {
      doc: seedStuckScan(),
      chunks: [],
      manifests: [],
      embeddings: [],
      reports: [],
    };
    harness.state = state;
    harness.db = createMemDb(state);
    harness.objectBytes = SCAN_PDF;
    mockEsStore.reset();
  });

  afterEach(() => {
    harness.state = null;
    harness.db = null;
    mockEsStore.reset();
  });

  it('开闸 + 注入：ocr→chunk→embed→es_index 双就绪且抬 indexVersion', async () => {
    const { stages, last } = await runChain(job('ocr'), {
      ocrExtract: async () => ({ text: OCR_TEXT, confidence: 0.95 }),
    });
    expect(stages).toEqual(['ocr', 'chunk', 'embed', 'es_index']);
    expect(last.errorCode).toBeUndefined();
    const doc = harness.state!.doc;
    expect(doc.status).toBe('ready');
    expect(doc.lifecycle).toBe('draft');
    expect(doc.extractMethod).toBe('ocr');
    expect(doc.indexVersion).toBe(1);
    expect(doc.embedReady).toBe(1);
    expect(doc.esReady).toBe(1);
    expect(harness.state!.manifests).toHaveLength(1);
  });

  it('无注入 → OCR_UNAVAILABLE，不抬 indexVersion', async () => {
    const result = await runIngestStage(job('ocr'));
    expect(result.errorCode).toBe('OCR_UNAVAILABLE');
    expect(harness.state!.doc.status).toBe('needs_ocr');
    expect(harness.state!.doc.indexVersion).toBe(0);
    expect(harness.state!.doc.parsedText).toBeNull();
    expect(harness.state!.manifests).toEqual([]);
  });

  it('utf8 文本层即使注入也拒抽，清空正文，不得 ready', async () => {
    harness.state!.doc.contentType = 'text/plain';
    harness.state!.doc.objectKey = 'kb/ocr/header.txt';
    harness.state!.doc.extractMethod = 'text';
    harness.state!.doc.parsedText = '仅页眉短字';
    const result = await runIngestStage(job('ocr'), {
      ocrExtract: async () => ({ text: OCR_TEXT, confidence: 0.99 }),
    });
    expect(result.errorCode).toBe('NO_TEXT_LAYER');
    expect(result.next).toBeUndefined();
    expect(harness.state!.doc.status).toBe('needs_ocr');
    expect(harness.state!.doc.parsedText).toBeNull();
    expect(harness.state!.doc.extractMethod).toBe('text');
    expect(harness.state!.doc.indexVersion).toBe(0);
    expect(harness.state!.doc.status).not.toBe('ready');
    expect(harness.state!.manifests).toEqual([]);
  });

  it('extractMethod null 的 utf8 历史行入队 ocr 也拒抽', async () => {
    harness.state!.doc.contentType = 'text/plain';
    harness.state!.doc.objectKey = 'kb/ocr/legacy.txt';
    harness.state!.doc.extractMethod = null;
    harness.state!.doc.parsedText = '旧短页眉';
    const result = await runIngestStage(job('ocr'), {
      ocrExtract: async () => ({ text: OCR_TEXT, confidence: 0.99 }),
    });
    expect(result.errorCode).toBe('NO_TEXT_LAYER');
    expect(harness.state!.doc.parsedText).toBeNull();
    expect(harness.state!.doc.indexVersion).toBe(0);
    expect(harness.state!.doc.status).not.toBe('ready');
  });

  it('关闸跑 ocr → NO_TEXT_LAYER，清空正文且不抬 version', async () => {
    workerEnv.INGEST_OCR_ENABLED = false;
    harness.state!.doc.parsedText = '残留';
    const result = await runIngestStage(job('ocr'), {
      ocrExtract: async () => ({ text: OCR_TEXT, confidence: 0.99 }),
    });
    expect(result.errorCode).toBe('NO_TEXT_LAYER');
    expect(harness.state!.doc.status).toBe('needs_ocr');
    expect(harness.state!.doc.parsedText).toBeNull();
    expect(harness.state!.doc.indexVersion).toBe(0);
    expect(harness.state!.manifests).toEqual([]);
  });
});
