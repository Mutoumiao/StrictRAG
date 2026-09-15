/**
 * 目标：chunk 必须服从快照 contextMode；L0 只用标题；l1_llm 本轮回退不得声称已跑 L1。
 * 需求：prds/04-pipelines/01-offline-ingest.md §4 · 功能表 §6
 * 被测：runIngestStage chunk
 * 简介：无 Gateway contextualize。禁止字面量 section。
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

const BODY =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';

const DOC_ID = '01900000-0000-7000-8000-0000000000d1';
const KB = '01900000-0000-7000-8000-0000000000aa';
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
  chunkStrategyParams: Record<string, unknown> | null;
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

vi.mock('../../src/env.js', () => ({ env: workerEnv }));
vi.mock('../../src/db.js', () => ({ getDb: () => harness.db }));
vi.mock('../../src/ingest/job-ledger.js', () => ({
  recordStageStart: async () => 'ledger-ctx',
  recordStageEnd: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function chunkJob(): IngestJobData {
  return { docId: DOC_ID, kbId: KB, tenantId: TENANT, stage: 'chunk' };
}

function boot(params: Record<string, unknown> | null): MemState {
  const current: MemDoc = {
    id: DOC_ID,
    tenantId: TENANT,
    kbId: KB,
    title: '考勤制度',
    objectKey: 'kb/x/current.txt',
    contentType: 'text/plain',
    approvalStatus: 'approved',
    status: 'parsed',
    errorCode: null,
    errorMessage: null,
    parsedText: BODY,
    extractMethod: 'utf8',
    mongoDocId: null,
    chunkStrategy: 'structure_paragraph',
    chunkStrategyParams: params,
    indexVersion: 0,
    embedReady: 0,
    esReady: 0,
    lifecycle: 'draft',
  };
  const state: MemState = {
    doc: current,
    docs: [current],
    chunks: [],
    manifests: [],
    embeddings: [],
    reports: [],
  };
  harness.state = state;
  harness.db = createMemDb(state);
  return state;
}

describe('chunk 服从 contextMode 快照', () => {
  beforeEach(() => {
    harness.state = null;
    harness.db = null;
  });

  it('l0_template：prefix 为标题，报告 contextSource=l0，无字面量 section', async () => {
    const state = boot({ contextMode: 'l0_template' });
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBeUndefined();
    expect(state.chunks).toHaveLength(1);
    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(String(state.chunks[0]?.contextPrefix)).not.toMatch(/section/);
    expect(state.reports[0]).toMatchObject({ contextSource: 'l0' });
  });

  it('默认 l1_llm：同一 L0 prefix，报告 l0_fallback', async () => {
    const state = boot({ contextMode: 'l1_llm', chunkTokens: 256 });
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBeUndefined();
    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({ contextSource: 'l0_fallback' });
    expect(JSON.stringify(state.reports[0])).not.toMatch(/l1_llm/);
  });

  it('快照缺省按 l1_llm 回退 L0', async () => {
    const state = boot(null);
    const result = await runIngestStage(chunkJob());
    expect(result.errorCode).toBeUndefined();
    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({ contextSource: 'l0_fallback' });
  });
});
