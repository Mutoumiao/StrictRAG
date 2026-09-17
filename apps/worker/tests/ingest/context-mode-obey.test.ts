/**
 * 目标：chunk 必须服从快照 contextMode；L0 只用标题；l1_llm 只有真调通才写 l1_llm，否则回退 L0。
 * 需求：prds/04-pipelines/01-offline-ingest.md §4 / §4.1 / §4.2 · 功能表 §6
 * 被测：runIngestStage chunk
 * 简介：默认 off 时 l1_llm 回退 L0（不写假 l1_llm）；http 模式成功写 l1_llm、失败回退；l0_template 不调 LLM。禁止字面量 section。
 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
  ingestReports,
} from '@strict-rag/db';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    // L1 被请求但本轮未实际调用（模式非 http）→ 整轮按回退计，与 contextSource 同口径
    expect(state.reports[0]).toMatchObject({ contextualizeL1Ok: 0, contextualizeL0Fallback: 1 });
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

describe('L1 contextualize（INGEST_CONTEXTUALIZE_MODE=http）', () => {
  const saved = { mode: workerEnv.INGEST_CONTEXTUALIZE_MODE, base: workerEnv.GATEWAY_BASE_URL };

  beforeEach(() => {
    harness.state = null;
    harness.db = null;
    workerEnv.INGEST_CONTEXTUALIZE_MODE = 'http';
    workerEnv.GATEWAY_BASE_URL = 'http://gw.local/v1';
  });

  afterEach(() => {
    workerEnv.INGEST_CONTEXTUALIZE_MODE = saved.mode;
    workerEnv.GATEWAY_BASE_URL = saved.base;
    vi.unstubAllGlobals();
  });

  it('成功：块 prefix 用模型输出，报告 contextSource=l1_llm', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '考勤制度：请假提交与审批要求' } }] }),
    }));
    vi.stubGlobal('fetch', fetchImpl);

    const state = boot({ contextMode: 'l1_llm', chunkTokens: 256 });
    const result = await runIngestStage(chunkJob());

    expect(result.errorCode).toBeUndefined();
    expect(state.chunks).toHaveLength(1);
    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度：请假提交与审批要求');
    expect(state.reports[0]).toMatchObject({ contextSource: 'l1_llm' });
    expect(state.reports[0]).toMatchObject({ contextualizeL1Ok: 1, contextualizeL0Fallback: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    // 正文不得被改写（只加 prefix）
    expect(state.chunks[0]?.bodyText).toBe(BODY);
  });

  it('失败（429）：回退 L0 prefix，报告 l0_fallback，块仍入库', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })));

    const state = boot({ contextMode: 'l1_llm', chunkTokens: 256 });
    const result = await runIngestStage(chunkJob());

    expect(result.errorCode).toBeUndefined();
    expect(state.chunks).toHaveLength(1);
    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({ contextSource: 'l0_fallback' });
    expect(state.reports[0]).toMatchObject({ contextualizeL1Ok: 0, contextualizeL0Fallback: 1 });
  });

  it('l0_template 不调 LLM（即便 http 开着）', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);

    const state = boot({ contextMode: 'l0_template' });
    await runIngestStage(chunkJob());

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({ contextSource: 'l0' });
    expect(state.reports[0]).toMatchObject({ contextualizeL1Ok: 0, contextualizeL0Fallback: 0 });
  });
});
