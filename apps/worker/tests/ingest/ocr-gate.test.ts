/**
 * 目标：OCR 开闸后无文本层才进独立 ocr stage；关闸行为不变；低置信不得 ready。
 * 需求：剧本 Q5 · Q8 · Q9 · ADR-043 · P5 OCR 开闸
 * 被测：runIngestStage · ocrStartupWarning · assertIngestBullOutcome
 * 简介：默认关。注入抽取器才续跑。无引擎不得假正文。
 */

import { UnrecoverableError } from 'bullmq';
import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
} from '@strict-rag/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { ocrStartupWarning } from '../../src/ocr-policy.js';
import { assertIngestBullOutcome } from '../../src/ingest/bull-outcome.js';

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
  INGEST_OCR_ENABLED: false,
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
    id: 'doc-ocr-scan',
    tenantId: 'tenant-ocr',
    kbId: 'kb-ocr',
    title: '扫描件',
    objectKey: 'kb/ocr/scan.pdf',
    contentType: 'application/pdf',
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
  recordStageStart: async () => 'ledger-ocr',
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
    docId: 'doc-ocr-scan',
    kbId: 'kb-ocr',
    tenantId: 'tenant-ocr',
    stage,
  };
}

describe('ocrStartupWarning', () => {
  it('关闸或非 staging/prod → 无告警；staging 开且无 ADR → 有告警', () => {
    expect(
      ocrStartupWarning({
        APP_ENV: 'staging',
        INGEST_OCR_ENABLED: false,
        INGEST_OCR_ADR_REF: '',
      }),
    ).toBeNull();
    expect(
      ocrStartupWarning({
        APP_ENV: 'development',
        INGEST_OCR_ENABLED: true,
        INGEST_OCR_ADR_REF: '',
      }),
    ).toBeNull();
    expect(
      ocrStartupWarning({
        APP_ENV: 'staging',
        INGEST_OCR_ENABLED: true,
        INGEST_OCR_ADR_REF: 'ADR-043',
      }),
    ).toBeNull();
    expect(
      ocrStartupWarning({
        APP_ENV: 'staging',
        INGEST_OCR_ENABLED: true,
        INGEST_OCR_ADR_REF: '',
      }),
    ).toMatch(/INGEST_OCR_ADR_REF/);
  });
});

describe('OCR 开闸最小闭环', () => {
  beforeEach(() => {
    workerEnv.INGEST_OCR_ENABLED = false;
    workerEnv.INGEST_OCR_MIN_CONFIDENCE = 0.7;
    const state: MemState = {
      doc: seedDoc(),
      chunks: [],
      manifests: [],
      embeddings: [],
    };
    harness.state = state;
    harness.db = createMemDb(state);
    harness.objectBytes = SCAN_PDF;
  });

  afterEach(() => {
    harness.state = null;
    harness.db = null;
  });

  it('关闸：PDF 无层 → NO_TEXT_LAYER，不入队 ocr', async () => {
    const result = await runIngestStage(job('parse'));
    expect(result.errorCode).toBe('NO_TEXT_LAYER');
    expect(result.next).toBeUndefined();
    expect(harness.state!.doc.status).toBe('needs_ocr');
    expect(harness.state!.doc.errorCode).toBe('NO_TEXT_LAYER');
  });

  it('开闸 + 高置信注入：parse 交 ocr，ocr 成功后入队 chunk', async () => {
    workerEnv.INGEST_OCR_ENABLED = true;
    const parsed = await runIngestStage(job('parse'));
    expect(parsed.errorCode).toBeUndefined();
    expect(parsed.next?.stage).toBe('ocr');
    expect(harness.state!.doc.status).toBe('needs_ocr');

    const ocr = await runIngestStage(job('ocr'), {
      ocrExtract: async () => ({ text: OCR_TEXT, confidence: 0.95 }),
    });
    expect(ocr.errorCode).toBeUndefined();
    expect(ocr.next?.stage).toBe('chunk');
    expect(harness.state!.doc.extractMethod).toBe('ocr');
    expect(harness.state!.doc.errorCode).toBeNull();
    expect(harness.state!.doc.parsedText).toContain('请假');
    expect(harness.state!.doc.status).not.toBe('ready');
    expect(harness.state!.manifests).toEqual([]);
  });

  it('开闸 + 低置信 → needs_review + OCR_LOW_CONFIDENCE，无成功 manifest', async () => {
    workerEnv.INGEST_OCR_ENABLED = true;
    await runIngestStage(job('parse'));
    const ocr = await runIngestStage(job('ocr'), {
      ocrExtract: async () => ({ text: OCR_TEXT, confidence: 0.2 }),
    });
    expect(ocr.errorCode).toBe('OCR_LOW_CONFIDENCE');
    expect(ocr.next).toBeUndefined();
    expect(harness.state!.doc.status).toBe('needs_review');
    expect(harness.state!.doc.parsedText).toBeNull();
    expect(harness.state!.doc.status).not.toBe('ready');
    expect(harness.state!.manifests).toEqual([]);

    const chunk = await runIngestStage(job('chunk'));
    expect(chunk.errorCode).toBe('OCR_LOW_CONFIDENCE');
    expect(harness.state!.manifests).toEqual([]);
  });

  it('开闸 + 无注入 → OCR_UNAVAILABLE，仍 needs_ocr', async () => {
    workerEnv.INGEST_OCR_ENABLED = true;
    await runIngestStage(job('parse'));
    const ocr = await runIngestStage(job('ocr'));
    expect(ocr.errorCode).toBe('OCR_UNAVAILABLE');
    expect(harness.state!.doc.status).toBe('needs_ocr');
    expect(harness.state!.doc.errorCode).toBe('OCR_UNAVAILABLE');
    expect(harness.state!.doc.errorCode).not.toBe('MALWARE');
    expect(harness.state!.doc.errorCode).not.toBe('NO_TEXT_LAYER');
  });

  it('OCR_LOW_CONFIDENCE 与 MALWARE 均不可重试且分码', () => {
    expect(() => assertIngestBullOutcome('OCR_LOW_CONFIDENCE')).toThrow(UnrecoverableError);
    expect(() => assertIngestBullOutcome('MALWARE')).toThrow(UnrecoverableError);
    expect(() => assertIngestBullOutcome('OCR_UNAVAILABLE')).toThrow(UnrecoverableError);
  });
});
