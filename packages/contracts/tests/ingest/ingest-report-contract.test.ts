/**
 * 目标：入库报告 DTO 须含跨 doc skip 事实，仍拒绝 Hit@k / 未知字段。
 * 需求：prds/05-api GET ingest-report · 功能表 §4.3 / §5.2 · 入库 PRD §5
 * 被测：IngestReportItemSchema
 * 简介：跨文档去重最小闭环形状；不是 pending_review、不是评测 Hit@k。
 */

import { describe, expect, it } from 'vitest';

import { IngestReportItemSchema } from '../../src/ingest/ingest-report.contract.js';

const PAIR = {
  otherDocId: '01900000-0000-7000-8000-0000000000d2',
  otherChunkId: '01900000-0000-7000-8000-0000000000c2',
  action: 'skip_index' as const,
};

const ROW = {
  id: '01900000-0000-7000-8000-0000000000a1',
  kbId: '01900000-0000-7000-8000-0000000000aa',
  docId: '01900000-0000-7000-8000-0000000000d1',
  indexVersion: 1,
  chunkCount: 3,
  internalDropped: 1,
  crossDocDropped: 1,
  dedupeCrossDocRate: 0.2,
  conflictPairs: [PAIR],
  contextSource: 'l0' as const,
  dualReady: true,
  embedReady: true,
  esReady: true,
  reconcile: { ok: true, missingCount: 0, orphanCount: 0 },
  createdAt: '2026-08-30 12:00:00',
};

describe('IngestReportItemSchema', () => {
  it('接受含跨 doc 冲突对的事实行', () => {
    expect(IngestReportItemSchema.parse(ROW)).toEqual(ROW);
  });

  it('无冲突时 crossDocDropped=0 且冲突对为空', () => {
    const parsed = IngestReportItemSchema.parse({
      ...ROW,
      crossDocDropped: 0,
      dedupeCrossDocRate: 0,
      conflictPairs: [],
      dualReady: false,
      reconcile: null,
    });
    expect(parsed.crossDocDropped).toBe(0);
    expect(parsed.dedupeCrossDocRate).toBe(0);
    expect(parsed.conflictPairs).toEqual([]);
    expect(parsed.reconcile).toBeNull();
  });

  it('去重率缺失记 null（分母为 0 的轮次 / 旧行），且拒绝越界与缺字段', () => {
    const parsed = IngestReportItemSchema.parse({ ...ROW, dedupeCrossDocRate: null });
    expect(parsed.dedupeCrossDocRate).toBeNull();

    expect(
      IngestReportItemSchema.safeParse({ ...ROW, dedupeCrossDocRate: 1.2 }).success,
    ).toBe(false);
    expect(IngestReportItemSchema.safeParse({ ...ROW, dedupeCrossDocRate: -0.1 }).success).toBe(
      false,
    );
    const withoutRate: Record<string, unknown> = { ...ROW };
    delete withoutRate.dedupeCrossDocRate;
    expect(IngestReportItemSchema.safeParse(withoutRate).success).toBe(false);
  });

  it('拒绝 Hit@k 与 pending_review 装齐字段', () => {
    expect(IngestReportItemSchema.safeParse({ ...ROW, hitAtK: 0.7 }).success).toBe(false);
    expect(IngestReportItemSchema.safeParse({ ...ROW, pendingReview: 1 }).success).toBe(false);
    expect(
      IngestReportItemSchema.safeParse({
        ...ROW,
        conflictPairs: [{ ...PAIR, action: 'downrank' }],
      }).success,
    ).toBe(false);
  });

  it('contextSource 三态：l0 / l0_fallback / l1_llm 接受，未知值拒', () => {
    for (const source of ['l0', 'l0_fallback', 'l1_llm'] as const) {
      expect(IngestReportItemSchema.safeParse({ ...ROW, contextSource: source }).success).toBe(true);
    }
    expect(IngestReportItemSchema.safeParse({ ...ROW, contextSource: 'l2_llm' }).success).toBe(
      false,
    );
  });
});
