/**
 * 目标：入库报告 DTO 只含已发生事实，拒绝跨 doc / Hit@k / 未知字段。
 * 需求：prds/05-api GET ingest-report · 功能表 §4.3 / §5.2
 * 被测：IngestReportItemSchema
 * 简介：最小闭环形状；不是去重引擎、不是评测 Hit@k。
 */

import { describe, expect, it } from 'vitest';

import { IngestReportItemSchema } from '../../src/ingest/ingest-report.contract.js';

const ROW = {
  id: '01900000-0000-7000-8000-0000000000a1',
  kbId: '01900000-0000-7000-8000-0000000000aa',
  docId: '01900000-0000-7000-8000-0000000000d1',
  indexVersion: 1,
  chunkCount: 3,
  internalDropped: 1,
  dualReady: true,
  embedReady: true,
  esReady: true,
  reconcile: { ok: true, missingCount: 0, orphanCount: 0 },
  createdAt: '2026-08-30 12:00:00',
};

describe('IngestReportItemSchema', () => {
  it('接受最小事实行', () => {
    expect(IngestReportItemSchema.parse(ROW)).toEqual(ROW);
  });

  it('对账可空（去重清空失败尚未对账）', () => {
    const parsed = IngestReportItemSchema.parse({ ...ROW, dualReady: false, reconcile: null });
    expect(parsed.reconcile).toBeNull();
    expect(parsed.dualReady).toBe(false);
  });

  it('拒绝跨 doc 与 Hit@k 装齐字段', () => {
    expect(IngestReportItemSchema.safeParse({ ...ROW, crossDocDropped: 0 }).success).toBe(false);
    expect(IngestReportItemSchema.safeParse({ ...ROW, hitAtK: 0.7 }).success).toBe(false);
  });
});
