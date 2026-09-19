/**
 * 目标：mock infected 扫描后文档不得进 parse，必须删除对象、不落正文与 chunk manifest，终态 failed/MALWARE。
 * 需求：剧本 M2 · prds/10-delivery/03-acceptance-scenarios.md · ADR-039
 * 被测：runIngestStage scan（INGEST_SCAN_MODE=mock_infected）+ object-store.deleteObject
 * 简介：注入 mock 感染（≠ 真杀毒，QUAL-2 未接）：断言对象已删、无 manifest / 无向量 / 无 Mongo 正文写入、
 *       状态链为 scanning→failed。对照：mock_clean 不删对象且入队 parse。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { createHarness, doc, miniPdf, objectStoreMock } from './_support/ingest-harness.js';

const OBJECT_KEY = 'kb/x/eicar-sample.pdf';

const mongoWrites = { docs: 0, chunkBodies: 0 };

const h = createHarness();

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h));
vi.mock('../../src/ingest/mongo-body.js', () => ({
  localMongoDocId: (docId: string) => `local:${docId}`,
  upsertDocumentBody: async () => {
    mongoWrites.docs += 1;
    return 'mongo-doc-1';
  },
  upsertChunkBodies: async () => {
    mongoWrites.chunkBodies += 1;
  },
  deleteBodiesForDoc: async () => undefined,
}));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

function stage(stageName: IngestJobData['stage']): IngestJobData {
  const current = doc(h.state!);
  return { docId: current.id, kbId: current.kbId, tenantId: current.tenantId, stage: stageName };
}

const SAMPLE_BYTES = miniPdf(
  'EICAR mock sample: not a real scan engine result, size within limit.',
);

beforeEach(() => {
  h.reset();
  mongoWrites.docs = 0;
  mongoWrites.chunkBodies = 0;
  mockEsStore.reset();
  h.env.INGEST_SCAN_MODE = 'mock_infected';
  h.boot(
    { objectKey: OBJECT_KEY, contentType: 'application/pdf', status: 'uploaded' },
    SAMPLE_BYTES,
  );
});

afterEach(() => {
  h.env.INGEST_SCAN_MODE = 'mock_clean';
  mockEsStore.reset();
});

describe('剧本 M2 · mock infected 的效果与终态', () => {
  it('scanning → failed/MALWARE：对象已删，无 manifest / 向量 / 正文写入', async () => {
    const result = await runIngestStage(stage('scan'));
    const state = h.state!;

    expect(result.errorCode).toBe('MALWARE');
    expect(result.done).toBe(true);
    expect(result.next).toBeUndefined();
    expect(doc(state).status).toBe('failed');
    expect(doc(state).errorCode).toBe('MALWARE');
    // 不得进 parse / chunk
    expect(state.statusSeq).toEqual(['scanning', 'failed']);

    // 对象已删（本地/S3 同一 deleteObject 口径）；≠ 真杀毒
    expect(h.deletedKeys).toEqual([OBJECT_KEY]);
    // 无 chunk_manifest、无向量、无 ES、无报告、无 Mongo 权威正文
    expect(state.manifests).toEqual([]);
    expect(state.chunks).toEqual([]);
    expect(state.embeddings).toEqual([]);
    expect(state.reports).toEqual([]);
    expect(mockEsStore.listVersions(doc(state).id)).toEqual([]);
    expect(mongoWrites).toEqual({ docs: 0, chunkBodies: 0 });
  });

  it('对照：mock_clean 不删对象且入队 parse', async () => {
    h.env.INGEST_SCAN_MODE = 'mock_clean';

    const result = await runIngestStage(stage('scan'));

    expect(result.errorCode).toBeUndefined();
    expect(result.next?.stage).toBe('parse');
    expect(doc(h.state!).status).toBe('scanning');
    expect(h.deletedKeys).toEqual([]);
  });
});
