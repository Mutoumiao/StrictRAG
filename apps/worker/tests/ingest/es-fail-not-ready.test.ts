/**
 * 目标：mock ES bulk 失败时文档不得 ready；即使 PG 向量已写，默认检索仍检不到。
 * 需求：剧本 L2 · prds/10-delivery/03-acceptance-scenarios.md · ADR-038
 * 被测：runIngestStage embed → es_index（INGEST_ES_MODE=fail）
 * 简介：默认 mock ES（≠ 生产 ES）。向量行存在但 esReady=0、status=failed，双闸谓词仍拒绝装载；
 *       ask 侧 HTTP 真值在 apps/api（ready-active-corpus）。对照：同夹具 mock ES 可 ready。
 */

import { isDefaultRetrievable } from '@strict-rag/db';
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

describe('剧本 L2 · ES 失败不得 ready', () => {
  it('注入 INGEST_ES_MODE=fail：status≠ready、esReady=0，且双闸仍拒绝装载', async () => {
    await upToEmbedded();
    const embeddingsWritten = h.state!.embeddings.length;
    expect(embeddingsWritten).toBeGreaterThan(0);

    h.env.INGEST_ES_MODE = 'fail';
    const indexed = await runIngestStage(stage('es_index'));

    expect(indexed.errorCode).toBe('ES_INDEX_FAILED');
    expect(indexed.done).toBe(true);
    const current = doc(h.state!);
    expect(current.status).toBe('failed');
    expect(current.errorCode).toBe('ES_INDEX_FAILED');
    expect(current.esReady).toBe(0);
    // 向量已写但仍不放行；也没在本次状态链里出现过 ready
    expect(h.state!.embeddings).toHaveLength(embeddingsWritten);
    expect(h.state!.statusSeq).not.toContain('ready');
    expect(mockEsStore.listVersions(current.id)).toEqual([]);

    // 双闸谓词（生产装载路径的同一真值源）；ask 的 HTTP 断言在 apps/api
    expect(isDefaultRetrievable({ status: current.status, lifecycle: 'active' })).toBe(false);
  });

  it('对照：同夹具走 mock ES 才 ready（失败原因确为 ES bulk）', async () => {
    await upToEmbedded();
    const indexed = await runIngestStage(stage('es_index'));

    expect(indexed.errorCode).toBeUndefined();
    const current = doc(h.state!);
    expect(current.status).toBe('ready');
    expect(current.esReady).toBe(1);
    expect(isDefaultRetrievable({ status: current.status, lifecycle: 'active' })).toBe(true);
  });
});
