/**
 * 目标：重索引 N+1 只有双就绪后才原子切换 active version；切换瞬间 ES 只见完整的 N 或 N+1，旧版 N 不被半套污染。
 * 需求：剧本 L4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-038 §2.2
 * 被测：runIngestStage chunk → embed → es_index（reindex 链路）+ documents.active_index_version 写入
 * 简介：默认 mock ES（≠ 生产 ES）。v1 已就绪在跑；reindex 抬到 v2：chunk/embed 期间 activeVersion 仍为 1，
 *       仅 es_index 双就绪那一条 UPDATE 同时写 indexVersion / activeIndexVersion / esReady / status=ready；失败路径不得动它。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IngestJobData } from '../../src/queues.js';
import { createHarness, doc, objectStoreMock, type MemState } from './_support/ingest-harness.js';

/** 重索引正文（与 v1 不同，确保切出新的 chunk 集） */
const BODY_V2 =
  '年假须在系统中提前三个工作日申请，直属负责人与人力资源部双签后方可休假。逾期未申请按事假处理。';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const DOC = '01900000-0000-7000-8000-0000000000d4';
const V1_CHUNK_IDS = ['chunk-v1-a', 'chunk-v1-b'];

const h = createHarness();

vi.mock('../../src/env.js', () => ({ env: h.env }));
vi.mock('../../src/db.js', () => ({ getDb: () => h.db }));
vi.mock('../../src/ingest/object-store.js', () => objectStoreMock(h));

const { runIngestStage } = await import('../../src/ingest/pipeline.js');
const { mockEsStore } = await import('../../src/ingest/es-store.js');

function stage(stageName: IngestJobData['stage']): IngestJobData {
  return { docId: DOC, kbId: KB, tenantId: TENANT, stage: stageName };
}

/** v1 完整在跑：chunk 行 + 冻结 manifest + 向量行 + mock ES 集全齐 */
function seedV1(state: MemState): void {
  for (const [i, chunkId] of V1_CHUNK_IDS.entries()) {
    state.chunks.push({
      id: chunkId,
      tenantId: TENANT,
      kbId: KB,
      docId: DOC,
      indexVersion: 1,
      ordinal: i,
      preview: 'v1 预览',
      bodyText: 'v1 正文（重索引前的旧版）',
      contextPrefix: '旧版标题',
      tokenCount: 8,
    });
    state.embeddings.push({
      id: `emb-v1-${i}`,
      tenantId: TENANT,
      kbId: KB,
      docId: DOC,
      chunkId,
      indexVersion: 1,
      model: 'mock-embed',
      dims: 8,
      embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
    });
  }
  state.manifests.push({
    id: 'manifest-v1',
    tenantId: TENANT,
    kbId: KB,
    docId: DOC,
    indexVersion: 1,
    chunkIds: [...V1_CHUNK_IDS],
    frozen: 1,
    strategy: 'structure_paragraph',
  });
  mockEsStore.bulkIndex(DOC, 1, V1_CHUNK_IDS);
}

function manifestIdsOf(state: MemState, indexVersion: number): string[] {
  const manifest = state.manifests.find((m) => m.indexVersion === indexVersion);
  expect(manifest, `manifest v${indexVersion}`).toBeTruthy();
  return [...(manifest!.chunkIds as string[])].sort();
}

/** 切换瞬间：ES 里出现的每个 version 都必须是完整集（不见半套） */
function expectEsVersionsComplete(state: MemState): void {
  for (const version of mockEsStore.listVersions(DOC)) {
    expect(mockEsStore.listChunkIds(DOC, version), `ES v${version} 不得是半套`).toEqual(
      manifestIdsOf(state, version),
    );
  }
}

function v1ChunkIdsInPg(state: MemState): string[] {
  return state.chunks
    .filter((c) => c.indexVersion === 1)
    .map((c) => String(c.id))
    .sort();
}

beforeEach(() => {
  h.reset();
  h.env.INGEST_ES_MODE = 'mock';
  h.env.INGEST_EMBED_MODE = 'mock';
  mockEsStore.reset();
  const state = h.boot(
    {
      id: DOC,
      kbId: KB,
      tenantId: TENANT,
      parsedText: BODY_V2,
      status: 'ready',
      lifecycle: 'active',
      extractMethod: 'text',
      indexVersion: 1,
      activeIndexVersion: 1,
      embedReady: 1,
      esReady: 1,
    },
    Buffer.from(BODY_V2, 'utf8'),
  );
  seedV1(state);
});

afterEach(() => {
  mockEsStore.reset();
});

describe('剧本 L4 · 重索引原子切换', () => {
  it('chunk/embed 期间 activeVersion 仍是 N；仅双就绪那一条 UPDATE 切到 N+1', async () => {
    const state = h.state!;

    const chunked = await runIngestStage(stage('chunk'));
    expect(chunked.errorCode).toBeUndefined();
    expect(doc(state).indexVersion).toBe(2);
    expect(doc(state).activeIndexVersion).toBe(1);
    expect(doc(state).status).not.toBe('ready');
    expect(doc(state).embedReady).toBe(0);
    expect(mockEsStore.listVersions(DOC)).toEqual([1]);
    expectEsVersionsComplete(state);

    const embedded = await runIngestStage(chunked.next!);
    expect(embedded.errorCode).toBeUndefined();
    expect(doc(state).embedReady).toBe(1);
    expect(doc(state).esReady).toBe(0);
    expect(doc(state).activeIndexVersion).toBe(1);
    expect(doc(state).status).not.toBe('ready');
    expect(mockEsStore.listVersions(DOC)).toEqual([1]);

    const indexed = await runIngestStage(embedded.next!);
    expect(indexed.errorCode).toBeUndefined();
    expect(indexed.done).toBe(true);
    expect(doc(state).status).toBe('ready');
    expect(doc(state).indexVersion).toBe(2);
    expect(doc(state).activeIndexVersion).toBe(2);
    expect(doc(state).esReady).toBe(1);
    expectEsVersionsComplete(state);

    // 原子：激活与 ready 必须落在同一条 documents UPDATE 上
    const activationPatches = state.docPatches.filter((p) => p.activeIndexVersion !== undefined);
    expect(activationPatches).toHaveLength(1);
    expect(activationPatches[0]).toMatchObject({
      indexVersion: 2,
      activeIndexVersion: 2,
      esReady: 1,
      status: 'ready',
    });
    // 旧版 N 未被半套污染：v1 的 chunk / 向量 / ES 集原样保留
    expect(v1ChunkIdsInPg(state)).toEqual([...V1_CHUNK_IDS].sort());
    expect(
      state.embeddings
        .filter((e) => e.indexVersion === 1)
        .map((e) => e.chunkId)
        .sort(),
    ).toEqual([...V1_CHUNK_IDS].sort());
    expect(mockEsStore.listChunkIds(DOC, 1)).toEqual([...V1_CHUNK_IDS].sort());
  });

  it('负向：新版本 ES 失败不得改 active version（旧版继续在跑）', async () => {
    const state = h.state!;

    const chunked = await runIngestStage(stage('chunk'));
    const embedded = await runIngestStage(chunked.next!);
    expect(embedded.errorCode).toBeUndefined();

    h.env.INGEST_ES_MODE = 'fail';
    const failed = await runIngestStage(embedded.next!);

    expect(failed.errorCode).toBe('ES_INDEX_FAILED');
    expect(doc(state).activeIndexVersion).toBe(1);
    expect(doc(state).status).toBe('failed');
    expect(doc(state).esReady).toBe(0);
    expect(state.docPatches.filter((p) => p.activeIndexVersion === 2)).toHaveLength(0);
    expect(mockEsStore.listVersions(DOC)).toEqual([1]);
    expectEsVersionsComplete(state);
  });
});
