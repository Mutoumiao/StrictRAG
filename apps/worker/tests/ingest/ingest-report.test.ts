/**
 * 目标：入库报告落库只写真事；同 version 更新保留文档内与跨 doc dropped。
 * 需求：功能表 §4.3 / §5.2 · prds/04-pipelines 入库报告
 * 被测：buildIngestReportInsert · persistIngestReport
 * 简介：非阻断；含跨 doc 冲突对；不含 Hit@k。
 */

import { ingestReports } from '@strict-rag/db';
import { describe, expect, it } from 'vitest';

import {
  buildIngestReportInsert,
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
    expect(row.conflictPairs).toEqual([PAIR]);
    expect(row.contextSource).toBe('l0');
    expect(row.dualReady).toBe(0);
    expect(row.reconcileOk).toBeNull();
    expect(row.reconcileMissing).toBeNull();
    expect(row).not.toHaveProperty('hitAtK');
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
      dualReady: number;
    };
    expect(patch.internalDropped).toBe(2);
    expect(patch.crossDocDropped).toBe(3);
    expect(patch.conflictPairs).toEqual([PAIR]);
    expect(patch.contextSource).toBe('l0');
    expect(patch.dualReady).toBe(1);
  });
});
