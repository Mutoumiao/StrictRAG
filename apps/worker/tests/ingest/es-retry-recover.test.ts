/**
 * 目标：ES 失败后重试成功必须能到 ready；对账必须发现「仅一边有」的 chunk。
 * 需求：剧本 L3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-038
 * 被测：runIngestStage es_index（先 fail 后 mock）+ mockEsStore.reconcile
 * 简介：默认 mock ES（≠ 生产 ES）。失败重试同 version 不重分块，成功后对账 missing/orphan 均为 0；
 *       负向：ES 侧多出的 chunk 必须报 ES_RECONCILE_FAILED 而不是假 ready。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { createHarness, doc, objectStoreMock } from './_support/ingest-harness.js';

const BODY =
  '请假须提前一个工作日提交书面申请，部门负责人审批后方可休假。未按流程办理的视为旷工处理。';

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

function manifestIdsOf(indexVersion: number): string[] {
  const manifest = h.state!.manifests.find((m) => m.indexVersion === indexVersion);
  expect(manifest, `manifest v${indexVersion}`).toBeTruthy();
  return [...(manifest!.chunkIds as string[])].sort();
}

/** 到 embed 结束（向量已写、尚未进 ES）的公共前置 */
async function upToEmbedded(): Promise<void> {
  expect((await runIngestStage(stage('chunk'))).errorCode).toBeUndefined();
  expect((await runIngestStage(stage('embed'))).errorCode).toBeUndefined();
  expect(doc(h.state!).embedReady).toBe(1);
}

beforeEach(() => {
  h.reset();
  h.env.INGEST_ES_MODE = 'mock';
  h.env.INGEST_EMBED_MODE = 'mock';
  mockEsStore.reset();
  h.boot({ parsedText: BODY, status: 'parsed', extractMethod: 'text' }, Buffer.from(BODY, 'utf8'));
});

afterEach(() => {
  mockEsStore.reset();
});

describe('剧本 L3 · ES 重试恢复与对账', () => {
  it('失败 → 同 version 重试成功 → ready，且对账 missing/orphan 均为 0', async () => {
    await upToEmbedded();
    const chunkIdsBefore = manifestIdsOf(doc(h.state!).indexVersion);

    h.env.INGEST_ES_MODE = 'fail';
    expect((await runIngestStage(stage('es_index'))).errorCode).toBe('ES_INDEX_FAILED');
    expect(doc(h.state!).esReady).toBe(0);
    const chunkIdsAfterFail = manifestIdsOf(doc(h.state!).indexVersion);
    // 重试路径不得重分块：manifest 冻结集不变
    expect(chunkIdsAfterFail).toEqual(chunkIdsBefore);

    h.env.INGEST_ES_MODE = 'mock';
    const retried = await runIngestStage(stage('es_index'));

    expect(retried.errorCode).toBeUndefined();
    expect(retried.done).toBe(true);
    const current = doc(h.state!);
    expect(current.status).toBe('ready');
    expect(current.esReady).toBe(1);
    expect(manifestIdsOf(current.indexVersion)).toEqual(chunkIdsBefore);
    expect(mockEsStore.listChunkIds(current.id, current.indexVersion)).toEqual(chunkIdsBefore);

    // 「仅一边有」告警口径：落库报告里的 missing / orphan 计数必须都为 0
    const report = h.state!.reports.find((r) => r.indexVersion === current.indexVersion);
    expect(report).toBeTruthy();
    expect(report).toMatchObject({
      reconcileOk: 1,
      reconcileMissing: 0,
      reconcileOrphan: 0,
      dualReady: 1,
      esReady: 1,
    });
  });

  it('负向：ES 侧多出 chunk → ES_RECONCILE_FAILED，不得假 ready', async () => {
    await upToEmbedded();
    const current = doc(h.state!);
    mockEsStore.bulkIndex(current.id, current.indexVersion, [
      ...manifestIdsOf(current.indexVersion),
      'ghost-chunk-not-in-manifest',
    ]);

    const indexed = await runIngestStage(stage('es_index'));

    expect(indexed.errorCode).toBe('ES_RECONCILE_FAILED');
    expect(doc(h.state!).status).toBe('failed');
    expect(doc(h.state!).esReady).toBe(0);
    const report = h.state!.reports.find((r) => r.indexVersion === current.indexVersion);
    expect(report).toMatchObject({ reconcileOk: 0, reconcileOrphan: 1, dualReady: 0 });
  });
});
