/**
 * 目标：入库报告落库只写真事；同 version 更新保留文档内与跨 doc dropped；去重率与计数同源；contextualize 两计数不得被后阶段复写。
 * 需求：功能表 §4.3 / §5.2 · prds/04-pipelines 入库报告 §5.2（指标必出）
 * 被测：buildIngestReportInsert · persistIngestReport · dedupeCrossDocRate
 * 简介：非阻断；含跨 doc 冲突对、`dedupe_cross_doc_rate`（分母 0 → null）与 `contextualize_l1_ok` / `contextualize_l0_fallback`；不含 Hit@k。
 */

import { ingestReports } from '@strict-rag/db';
import { describe, expect, it } from 'vitest';

import {
  buildIngestReportInsert,
  dedupeCrossDocRate,
  persistIngestReport,
  type IngestReportSnapshot,
} from '../../src/ingest/ingest-report.js';

const PAIR = {
  otherDocId: '01900000-0000-7000-8000-0000000000d2',
  otherChunkId: '01900000-0000-7000-8000-0000000000c2',
  action: 'skip_index' as const,
};

const SNAP: IngestReportSnapshot = {
  tenantId: '01900000-0000-7000-8000-0000000000t1',
  kbId: '01900000-0000-7000-8000-0000000000k1',
  docId: '01900000-0000-7000-8000-0000000000d1',
  indexVersion: 2,
  chunkCount: 4,
  internalDropped: 2,
  crossDocDropped: 3,
  conflictPairs: [PAIR],
  contextSource: 'l0',
  contextualizeL1Ok: 3,
  contextualizeL0Fallback: 1,
  dualReady: false,
  embedReady: false,
  esReady: false,
  reconcile: null,
};

describe('ingest report persist', () => {
  it('build 写入跨 doc 计数与冲突对，对账缺失仍为 null', () => {
    const row = buildIngestReportInsert(SNAP);
    expect(row.chunkCount).toBe(4);
    expect(row.internalDropped).toBe(2);
    expect(row.crossDocDropped).toBe(3);
    // 4 存活 + 2 文档内丢弃 + 3 跨文档丢弃 = 9 参与去重 → 3/9
    expect(row.dedupeCrossDocRate).toBeCloseTo(1 / 3, 6);
    expect(row.conflictPairs).toEqual([PAIR]);
    expect(row.contextSource).toBe('l0');
    expect(row.contextualizeL1Ok).toBe(3);
    expect(row.contextualizeL0Fallback).toBe(1);
    expect(row.dualReady).toBe(0);
    expect(row.reconcileOk).toBeNull();
    expect(row.reconcileMissing).toBeNull();
    expect(row).not.toHaveProperty('hitAtK');
  });

  it('分母为 0（本轮没有参与去重的切片）时去重率记 null，不得写 0', () => {
    expect(
      dedupeCrossDocRate({ chunkCount: 0, internalDropped: 0, crossDocDropped: 0 }),
    ).toBeNull();
    const row = buildIngestReportInsert({
      ...SNAP,
      chunkCount: 0,
      internalDropped: 0,
      crossDocDropped: 0,
    });
    expect(row.dedupeCrossDocRate).toBeNull();
  });

  it('全被去重清空时记 1（不是 null、也不是 0）', () => {
    expect(dedupeCrossDocRate({ chunkCount: 0, internalDropped: 0, crossDocDropped: 5 })).toBe(1);
  });

  it('build 对账失败不标双就绪', () => {
    const row = buildIngestReportInsert({
      ...SNAP,
      dualReady: false,
      embedReady: true,
      esReady: false,
      reconcile: { ok: false, missing: ['c1'], orphan: [] },
    });
    expect(row.dualReady).toBe(0);
    expect(row.embedReady).toBe(1);
    expect(row.esReady).toBe(0);
    expect(row.reconcileOk).toBe(0);
    expect(row.reconcileMissing).toBe(1);
    expect(row.reconcileOrphan).toBe(0);
  });

  it('同 version 更新保留已有 internalDropped 与跨 doc 事实', async () => {
    const inserted: unknown[] = [];
    const updated: unknown[] = [];
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => {
              expect(table).toBe(ingestReports);
              return [
                {
                  id: 'row-1',
                  internalDropped: 2,
                  crossDocDropped: 3,
                  conflictPairs: [PAIR],
                  contextSource: 'l0',
                  contextualizeL1Ok: 3,
                  contextualizeL0Fallback: 1,
                },
              ];
            },
          }),
        }),
      }),
      update: (table: unknown) => ({
        set: (patch: Record<string, unknown>) => ({
          where: async () => {
            expect(table).toBe(ingestReports);
            updated.push(patch);
          },
        }),
      }),
      insert: () => ({
        values: async (row: unknown) => {
          inserted.push(row);
        },
      }),
    };

    await persistIngestReport(db as never, {
      ...SNAP,
      internalDropped: 0,
      crossDocDropped: 0,
      conflictPairs: [],
      contextSource: null,
      contextualizeL1Ok: null,
      contextualizeL0Fallback: null,
      dualReady: true,
      embedReady: true,
      esReady: true,
      reconcile: { ok: true, missing: [], orphan: [] },
    });
    expect(inserted).toHaveLength(0);
    expect(updated).toHaveLength(1);
    const patch = updated[0] as {
      internalDropped: number;
      crossDocDropped: number;
      conflictPairs: unknown;
      contextualizeL1Ok: number | null;
      contextualizeL0Fallback: number | null;
      dualReady: number;
    };
    expect(patch.internalDropped).toBe(2);
    expect(patch.crossDocDropped).toBe(3);
    expect(patch.conflictPairs).toEqual([PAIR]);
    expect(patch.contextSource).toBe('l0');
    // 后阶段（es_index）不带计数，不得把 chunk 段已记录值复写成 null
    expect(patch.contextualizeL1Ok).toBe(3);
    expect(patch.contextualizeL0Fallback).toBe(1);
    expect(patch.dualReady).toBe(1);
  });
});
