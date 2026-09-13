/**
 * 目标：purge 必须清对象与 mock 稀疏、空 Mongo 不连，且不要求已审批。
 * 需求：功能表 §5.2 · ADR-020 · 剧本 E3
 * 被测：runDocumentPurge · pipelineRequiresApproval · mockEsStore.dropDoc
 * 简介：二次 purge 不抛。≠ HTTP ES deleteByQuery。≠ PG 硬删。
 */

import { describe, expect, it } from 'vitest';

import { mockEsStore } from '../../src/ingest/es-store.js';
import { pipelineRequiresApproval, runDocumentPurge } from '../../src/ingest/purge.js';

describe('pipelineRequiresApproval', () => {
  it('purge 不要求审批；入库正向阶段要求', () => {
    expect(pipelineRequiresApproval('purge')).toBe(false);
    expect(pipelineRequiresApproval('scan')).toBe(true);
    expect(pipelineRequiresApproval('es_index')).toBe(true);
  });
});

describe('runDocumentPurge', () => {
  it('删对象、drop 稀疏、调 Mongo 删、回写 archived 标志', async () => {
    const deleted: Array<string | null> = [];
    const mongo: string[] = [];
    const patches: Array<{ objectKey: null; embedReady: 0; esReady: 0 }> = [];
    mockEsStore.reset();
    mockEsStore.bulkIndex('doc-1', 1, ['c1']);
    mockEsStore.bulkIndex('doc-2', 1, ['c2']);

    await runDocumentPurge(
      { id: 'doc-1', objectKey: 'kb/k/doc-1' },
      {
        deleteObject: async (key) => {
          deleted.push(key);
        },
        dropSparse: (id) => mockEsStore.dropDoc(id),
        deleteMongoBodies: async (id) => {
          mongo.push(id);
        },
        patchDoc: async (patch) => {
          patches.push(patch);
        },
      },
    );

    expect(deleted).toEqual(['kb/k/doc-1']);
    expect(mongo).toEqual(['doc-1']);
    expect(patches).toEqual([
      { lifecycle: 'archived', objectKey: null, embedReady: 0, esReady: 0 },
    ]);
    expect(mockEsStore.listChunkIds('doc-1', 1)).toEqual([]);
    expect(mockEsStore.listChunkIds('doc-2', 1)).toEqual(['c2']);
  });

  it('二次 purge 不抛', async () => {
    const deps = {
      deleteObject: async () => undefined,
      dropSparse: () => undefined,
      deleteMongoBodies: async () => undefined,
      patchDoc: async () => undefined,
    };
    await runDocumentPurge({ id: 'doc-1', objectKey: null }, deps);
    await expect(runDocumentPurge({ id: 'doc-1', objectKey: null }, deps)).resolves.toBeUndefined();
  });
});
