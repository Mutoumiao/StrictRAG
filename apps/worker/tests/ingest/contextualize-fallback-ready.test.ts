/**
 * 目标：L1 contextualize 故障时必须回退 L0，且文档仍走完 embed→es_index 并 ready。
 * 需求：剧本 E5 · prds/10-delivery/03-acceptance-scenarios.md（L1 故障 → L0 回退仍 ready）
 * 被测：runIngestStage chunk → embed → es_index 全链
 * 简介：500 / 503 / 畸形响应 / 空输出 / 网络中断（AbortError）各注入一次；断言文档 status=ready 且报告 contextSource=l0_fallback、两计数自洽；
 *       成功路径作对照（l1_llm + 计数 1/0）。未验证真 Gateway（fetch 为注入替身）。
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

const DOC_ID = '01900000-0000-7000-8000-0000000000e5';
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
  ownerDeptId?: string | null;
  aclPrincipals?: string[] | null;
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
  INGEST_CONTEXTUALIZE_MODE: 'off',
};

const harness = {
  state: null as MemState | null,
  db: null as ReturnType<typeof createMemDb> | null,
};

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
  recordStageStart: async () => 'ledger-ctx-e5',
  recordStageEnd: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

function stageJob(stage: IngestJobData['stage']): IngestJobData {
  return { docId: DOC_ID, kbId: KB, tenantId: TENANT, stage };
}

function boot(): MemState {
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
    chunkStrategyParams: { contextMode: 'l1_llm', chunkTokens: 256 },
    indexVersion: 0,
    embedReady: 0,
    esReady: 0,
    lifecycle: 'draft',
    ownerDeptId: null,
    aclPrincipals: null,
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

/** chunk → embed → es_index 全链；断言无阶段报错 */
async function runFullChain(state: MemState): Promise<void> {
  const chunked = await runIngestStage(stageJob('chunk'));
  expect(chunked.errorCode).toBeUndefined();
  const embedded = await runIngestStage(stageJob('embed'));
  expect(embedded.errorCode).toBeUndefined();
  const indexed = await runIngestStage(stageJob('es_index'));
  expect(indexed.errorCode).toBeUndefined();
  expect(state.doc.embedReady).toBe(1);
  expect(state.doc.esReady).toBe(1);
  expect(state.doc.status).toBe('ready');
}

describe('L1 contextualize 故障 → 文档仍 ready（剧本 E5）', () => {
  const saved = {
    mode: workerEnv.INGEST_CONTEXTUALIZE_MODE,
    base: workerEnv.GATEWAY_BASE_URL,
  };

  beforeEach(() => {
    harness.state = null;
    harness.db = null;
    mockEsStore.reset();
    workerEnv.INGEST_CONTEXTUALIZE_MODE = 'http';
    workerEnv.GATEWAY_BASE_URL = 'http://gw.local/v1';
  });

  afterEach(() => {
    workerEnv.INGEST_CONTEXTUALIZE_MODE = saved.mode;
    workerEnv.GATEWAY_BASE_URL = saved.base;
    vi.unstubAllGlobals();
  });

  it('对照：contextualize 成功 → l1_llm，文档仍 ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '考勤制度：请假提交与审批要求' } }],
        }),
      })),
    );
    const state = boot();

    await runFullChain(state);

    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度：请假提交与审批要求');
    expect(state.reports[0]).toMatchObject({
      contextSource: 'l1_llm',
      contextualizeL1Ok: 1,
      contextualizeL0Fallback: 0,
    });
  });

  for (const status of [500, 503] as const) {
    it(`故障（HTTP ${status}）→ L0 回退，文档仍 ready`, async () => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status })));
      const state = boot();

      await runFullChain(state);

      expect(state.chunks).toHaveLength(1);
      expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
      expect(state.chunks[0]?.bodyText).toBe(BODY);
      // 报告不得被 embed / es_index 的空快照复写
      expect(state.reports[0]).toMatchObject({
        contextSource: 'l0_fallback',
        contextualizeL1Ok: 0,
        contextualizeL0Fallback: 1,
      });
    });
  }

  it('故障（畸形响应）→ L0 回退，文档仍 ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      })),
    );
    const state = boot();

    await runFullChain(state);

    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({
      contextSource: 'l0_fallback',
      contextualizeL1Ok: 0,
      contextualizeL0Fallback: 1,
    });
  });

  it('故障（模型输出空白）→ L0 回退，文档仍 ready', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: '   \n  ' } }] }),
      })),
    );
    const state = boot();

    await runFullChain(state);

    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({
      contextSource: 'l0_fallback',
      contextualizeL1Ok: 0,
      contextualizeL0Fallback: 1,
    });
  });

  it('故障（网络中断 AbortError）→ L0 回退，文档仍 ready', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw abortErr;
      }),
    );
    const state = boot();

    await runFullChain(state);

    expect(state.chunks[0]?.contextPrefix).toBe('考勤制度');
    expect(state.reports[0]).toMatchObject({
      contextSource: 'l0_fallback',
      contextualizeL1Ok: 0,
      contextualizeL0Fallback: 1,
    });
  });

  it('回退时口径自洽：contextSource 与两计数不得互相矛盾', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 })));
    const state = boot();

    await runFullChain(state);

    const report = state.reports[0] as {
      contextSource: string;
      contextualizeL1Ok: number;
      contextualizeL0Fallback: number;
    };
    if (report.contextSource === 'l0_fallback') {
      expect(report.contextualizeL0Fallback).toBeGreaterThan(0);
    }
    expect(report.contextualizeL1Ok).toBe(0);
  });
});
