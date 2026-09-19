/**
 * 目标：KB 策略 crossDocDedupeAction=pending_review 时，冲突块须落库入审但不进 manifest；默认 skip_index 行为不变。
 * 需求：剧本 E4 · prds/04-pipelines/01-offline-ingest.md §5.1 · 数据 PRD §3.2
 * 被测：runIngestStage chunk · loadCrossDocDedupeAction
 * 简介：held 块带 dedupe_status=pending_review 与 duplicate_of；报告冲突对带 heldChunkId；默认仍 skip_index。
 */

import {
  chunkEmbeddings,
  chunkManifests,
  chunks,
  documents,
  ingestReports,
  knowledgeBases,
} from '@strict-rag/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';

const DUP =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';
const NEAR =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理！';
const UNIQUE =
  '差旅报销须在返程后五个工作日内提交发票与行程单，逾期不予受理。本条用于保留可索引块。';

const CURRENT = '01900000-0000-7000-8000-0000000000c1';
const OTHER = '01900000-0000-7000-8000-0000000000c2';
const OTHER_CHUNK = '01900000-0000-7000-8000-0000000000c3';
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
  activeIndexVersion: number | null;
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
  kbConfig: Record<string, unknown>;
};

const workerEnv = {
  APP_ENV: 'test',
  LOG_LEVEL: 'silent',
  INGEST_SCAN_MODE: 'mock_clean',
  INGEST_MIN_EXTRACTED_CHARS: 10,
  INGEST_EMBED_MODE: 'mock',
  INGEST_ES_MODE: 'mock',
  INGEST_CONTEXTUALIZE_MODE: 'off',
  MONGODB_URL: '',
  GATEWAY_BASE_URL: '',
  GATEWAY_API_KEY: '',
  ELASTICSEARCH_URL: '',
};

const harness = { state: null as MemState | null, db: null as unknown };

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
          if (table === knowledgeBases) return asRows([{ configJson: state.kbConfig }]);
          return asRows([]);
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if (table === documents) Object.assign(state.doc, patch);
          if (table === ingestReports && state.reports[0]) Object.assign(state.reports[0], patch);
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
  recordStageStart: async () => 'ledger-dedupe',
  recordStageEnd: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');

function memDoc(over: Partial<MemDoc>): MemDoc {
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
    chunkStrategyParams: null,
    indexVersion: 1,
    activeIndexVersion: 1,
    embedReady: 1,
    esReady: 1,
    lifecycle: 'active',
    ...over,
  };
}

function boot(parsedText: string, kbConfig: Record<string, unknown>) {
  const current = memDoc({
    id: CURRENT,
    title: '新制度',
    status: 'parsed',
    parsedText,
    indexVersion: 0,
    activeIndexVersion: null,
    embedReady: 0,
    esReady: 0,
    lifecycle: 'draft',
  });
  const other = memDoc({});
  const state: MemState = {
    doc: current,
    docs: [current, other],
    chunks: [{ id: OTHER_CHUNK, kbId: KB, docId: OTHER, bodyText: DUP, indexVersion: 1 }],
    manifests: [],
    embeddings: [],
    reports: [],
    kbConfig,
  };
  harness.state = state;
  harness.db = createMemDb(state);
  return state;
}

function chunkJob(): IngestJobData {
  return { docId: CURRENT, kbId: KB, tenantId: TENANT, stage: 'chunk' };
}

describe('跨 doc 去重动作由 KB 策略决定（剧本 E4）', () => {
  beforeEach(() => {
    harness.state = null;
    harness.db = null;
  });

  it('pending_review：全文都待审 → 不得 ready（EMPTY_CHUNKS），但 held 行仍在（供运营处理）', async () => {
    const state = boot(NEAR, { crossDocDedupeAction: 'pending_review' });

    const result = await runIngestStage(chunkJob());

    expect(result.errorCode).toBe('EMPTY_CHUNKS');
    expect(result.next).toBeUndefined();
    expect(state.doc.status).toBe('failed');
    expect(state.chunks.filter((c) => c.dedupeStatus === 'pending_review')).toHaveLength(1);
    expect(state.manifests).toHaveLength(0);
  });

  it('pending_review：唯一块可索引 + 冲突块入审（manifest 不含 held）', async () => {
    const state = boot(`${NEAR}\n\n${UNIQUE}`, { crossDocDedupeAction: 'pending_review' });

    const result = await runIngestStage(chunkJob());

    expect(result.errorCode).toBeUndefined();
    expect(result.next?.stage).toBe('embed');
    const ids = (state.manifests[0] as { chunkIds: string[] }).chunkIds;
    expect(ids).toHaveLength(1);

    const held = state.chunks.filter((c) => c.dedupeStatus === 'pending_review');
    expect(held).toHaveLength(1);
    expect(held[0]?.duplicateOf).toBe(OTHER_CHUNK);
    expect(held[0]?.bodyText).toBe(NEAR);
    expect(ids).not.toContain(held[0]?.id);

    expect(state.reports[0]).toMatchObject({ crossDocDropped: 1, chunkCount: 1 });
    const pairs = (state.reports[0] as { conflictPairs: Array<Record<string, unknown>> })
      .conflictPairs;
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      otherDocId: OTHER,
      otherChunkId: OTHER_CHUNK,
      action: 'pending_review',
      heldChunkId: held[0]?.id,
    });
  });

  it('默认（未写策略）：仍走 skip_index，不落 held 行、无 heldChunkId', async () => {
    const state = boot(`${NEAR}\n\n${UNIQUE}`, {});
    const chunksBefore = state.chunks.length;

    const result = await runIngestStage(chunkJob());

    expect(result.errorCode).toBeUndefined();
    // 只落可索引那一块；冲突块照旧丢弃（不落库）
    expect(state.chunks).toHaveLength(chunksBefore + 1);
    expect(state.chunks.some((c) => c.dedupeStatus === 'pending_review')).toBe(false);
    const pairs = (state.reports[0] as { conflictPairs: Array<Record<string, unknown>> })
      .conflictPairs;
    expect(pairs).toEqual([
      { otherDocId: OTHER, otherChunkId: OTHER_CHUNK, action: 'skip_index' },
    ]);
  });

  it('脏值（downrank）：回落 skip_index，不得静默当 pending_review', async () => {
    const state = boot(`${NEAR}\n\n${UNIQUE}`, { crossDocDedupeAction: 'downrank' });

    await runIngestStage(chunkJob());

    expect(state.chunks.some((c) => c.dedupeStatus === 'pending_review')).toBe(false);
  });
});
