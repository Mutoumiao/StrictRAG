/**
 * 目标：入库报告行映射不得把 null 对账或未记录的去重率填成 0 装齐。
 * 需求：功能表 §5.2 · prds/04-pipelines 入库报告 §5.2
 * 被测：toIngestReportItem
 * 简介：查询契约；落库在 worker；去重率原样回读（null 仍是 null）。
 */

import { describe, expect, it } from 'vitest';

import { toIngestReportItem } from '../../src/services/ingest-reports.js';

describe('toIngestReportItem', () => {
  it('maps dual-ready row with reconcile', () => {
    const item = toIngestReportItem({
      id: '01900000-0000-7000-8000-0000000000a1',
      kbId: '01900000-0000-7000-8000-0000000000aa',
      docId: '01900000-0000-7000-8000-0000000000d1',
      indexVersion: 1,
      chunkCount: 3,
      internalDropped: 1,
      crossDocDropped: 2,
      dedupeCrossDocRate: 0.3333333,
      contextSource: 'l0_fallback',
      contextualizeL1Ok: 5,
      contextualizeL0Fallback: 1,
      conflictPairs: [
        {
          otherDocId: '01900000-0000-7000-8000-0000000000d2',
          otherChunkId: '01900000-0000-7000-8000-0000000000c2',
          action: 'skip_index' as const,
        },
      ],
      dualReady: 1,
      embedReady: 1,
      esReady: 1,
      reconcileOk: 1,
      reconcileMissing: 0,
      reconcileOrphan: 0,
      createdAt: '2026-08-30 12:00:00',
    });
    expect(item.dualReady).toBe(true);
    expect(item.crossDocDropped).toBe(2);
    expect(item.dedupeCrossDocRate).toBeCloseTo(0.3333333, 6);
    expect(item.contextSource).toBe('l0_fallback');
    expect(item.contextualizeL1Ok).toBe(5);
    expect(item.contextualizeL0Fallback).toBe(1);
    expect(item.conflictPairs).toHaveLength(1);
    expect(item.reconcile).toEqual({ ok: true, missingCount: 0, orphanCount: 0 });
  });

  it('keeps reconcile null when not yet reconciled', () => {
    const item = toIngestReportItem({
      id: '01900000-0000-7000-8000-0000000000a2',
      kbId: '01900000-0000-7000-8000-0000000000aa',
      docId: '01900000-0000-7000-8000-0000000000d2',
      indexVersion: 1,
      chunkCount: 0,
      internalDropped: 4,
      crossDocDropped: 0,
      dedupeCrossDocRate: null,
      contextSource: 'bogus',
      contextualizeL1Ok: null,
      contextualizeL0Fallback: null,
      conflictPairs: [],
      dualReady: 0,
      embedReady: 0,
      esReady: 0,
      reconcileOk: null,
      reconcileMissing: null,
      reconcileOrphan: null,
      createdAt: '2026-08-30 12:00:00',
    });
    expect(item.dualReady).toBe(false);
    expect(item.reconcile).toBeNull();
    expect(item.internalDropped).toBe(4);
    // 分母为 0 → 未记录，不得被映射成 0
    expect(item.dedupeCrossDocRate).toBeNull();
    expect(item.contextSource).toBeNull();
    // 迁移前旧行两计数未记录 → 同样不得填 0
    expect(item.contextualizeL1Ok).toBeNull();
    expect(item.contextualizeL0Fallback).toBeNull();
  });
});
