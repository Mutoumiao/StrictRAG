/**
 * 目标：样例 MD 与「有文本层 PDF」跑到 ready，且同一 indexVersion 下 PG chunk_embeddings 与稀疏索引集合逐一对账一致。
 * 需求：剧本 L1 · prds/10-delivery/03-acceptance-scenarios.md · ADR-038
 * 被测：runIngestStage scan → parse → chunk → embed → es_index
 * 简介：默认 mock 栈（mock embed / mock ES）。断言 manifest 冻结集 ≡ PG 向量集 ≡ mock ES 集，逐块正文非空且同 version。
 *       默认 `INGEST_ES_MODE=mock`，≠ 生产 ES；≠ 真杀毒。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import {
  createHarness,
  doc,
  idsOf,
  miniPdf,
  objectStoreMock,
  type MemState,
} from './_support/ingest-harness.js';

/** 两段正文：每段均须长于 INGEST_MIN_EXTRACTED_CHARS（40），否则被段落切分丢掉 */
const MD_BODY =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。\n\n年假以入职日期为起点计算，满一年享受五天，之后每满一年增加一天，累计上限十五天，须提前申请。';

const PDF_TEXT =
  'Annual leave policy: 15 days per year; submit the written request one working day ahead.';

const h = createHarness();

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

function stage(stageName: IngestJobData['stage']): IngestJobData {
  const current = doc(h.state!);
  return { docId: current.id, kbId: current.kbId, tenantId: current.tenantId, stage: stageName };
}

/** 同一 indexVersion：chunk 行 ≡ manifest 冻结集 ≡ PG 向量集 ≡ mock ES 集 */
function expectSameVersionSets(state: MemState, indexVersion: number): string[] {
  const manifest = state.manifests.find((m) => m.indexVersion === indexVersion);
  expect(manifest, `manifest v${indexVersion}`).toBeTruthy();
  const manifestIds = [...(manifest!.chunkIds as string[])].sort();
  expect(manifestIds.length).toBeGreaterThan(0);

  const chunkIds = idsOf(state.chunks, indexVersion, 'id');
  expect(chunkIds, 'chunk 行集合').toEqual(manifestIds);
  expect(idsOf(state.embeddings, indexVersion, 'chunkId'), 'PG 向量集合').toEqual(manifestIds);
  expect(
    mockEsStore.listChunkIds(doc(state).id, indexVersion),
    'mock ES 集合（≠ 生产 ES）',
  ).toEqual(manifestIds);

  for (const row of state.chunks.filter((c) => c.indexVersion === indexVersion)) {
    expect(
      String(row.bodyText ?? '').trim().length,
      'searchable chunk 正文不得为空',
    ).toBeGreaterThan(0);
    expect(row.kbId).toBe(doc(state).kbId);
  }
  for (const row of state.embeddings.filter((e) => e.indexVersion === indexVersion)) {
    expect(row.docId).toBe(doc(state).id);
    expect(row.kbId).toBe(doc(state).kbId);
    expect((row.embedding as number[]).length).toBeGreaterThan(0);
  }
  return manifestIds;
}

beforeEach(() => {
  h.reset();
  h.env.INGEST_ES_MODE = 'mock';
  h.env.INGEST_EMBED_MODE = 'mock';
  mockEsStore.reset();
});

afterEach(() => {
  mockEsStore.reset();
});

describe('剧本 L1 · 样例到双就绪 ready（PG 向量 ≡ ES 集）', () => {
  it('MD 样例：scan→parse→chunk→embed→es_index 后逐块对账一致', async () => {
    const state = h.boot(
      { title: '请假制度', objectKey: 'kb/x/policy.md', contentType: 'text/markdown' },
      Buffer.from(MD_BODY, 'utf8'),
    );

    for (const name of ['scan', 'parse', 'chunk', 'embed', 'es_index'] as const) {
      const result = await runIngestStage(stage(name));
      expect(result.errorCode, `${name} 不得报错`).toBeUndefined();
    }

    const current = doc(state);
    expect(current.extractMethod).toBe('text');
    expect(current.parsedText).toContain('请假须提前一个工作日');
    expect(current.embedReady).toBe(1);
    expect(current.esReady).toBe(1);
    expect(current.status).toBe('ready');
    expect(current.indexVersion).toBe(1);
    expectSameVersionSets(state, current.indexVersion);
  });

  it('有文本层 PDF 样例：抽文本层后同样跑到双就绪并逐块对账', async () => {
    const state = h.boot(
      { title: '年假制度', objectKey: 'kb/x/leave.pdf', contentType: 'application/pdf' },
      miniPdf(PDF_TEXT),
    );

    for (const name of ['scan', 'parse', 'chunk', 'embed', 'es_index'] as const) {
      const result = await runIngestStage(stage(name));
      expect(result.errorCode, `${name} 不得报错`).toBeUndefined();
    }

    const current = doc(state);
    expect(current.extractMethod).toBe('pdf_text');
    expect(current.parsedText).toContain('Annual leave policy');
    expect(current.status).toBe('ready');
    expect(current.esReady).toBe(1);
    expectSameVersionSets(state, current.indexVersion);
  });
});
