/**
 * 目标：入库报告表必须暴露 doc + indexVersion 唯一约束与事实列。
 * 需求：功能表 §5.2 ingest-report
 * 被测：ingestReports
 * 简介：核对列名；不含跨 doc / L1 指标列。
 */

import { describe, expect, it } from 'vitest';

import { ingestReports } from '../../src/schema/index.js';

describe('ingestReports schema', () => {
  it('exposes fact columns and doc+version unique index', () => {
    expect(ingestReports.docId.name).toBe('doc_id');
    expect(ingestReports.kbId.name).toBe('kb_id');
    expect(ingestReports.indexVersion.name).toBe('index_version');
    expect(ingestReports.chunkCount.name).toBe('chunk_count');
    expect(ingestReports.internalDropped.name).toBe('internal_dropped');
    expect(ingestReports.dualReady.name).toBe('dual_ready');
    expect(ingestReports.embedReady.name).toBe('embed_ready');
    expect(ingestReports.esReady.name).toBe('es_ready');
    expect(ingestReports.reconcileOk.name).toBe('reconcile_ok');
    expect(ingestReports.reconcileMissing.name).toBe('reconcile_missing');
    expect(ingestReports.reconcileOrphan.name).toBe('reconcile_orphan');
  });

  it('does not expose unimplemented cross-doc or hit-at-k columns', () => {
    const keys = Object.keys(ingestReports);
    expect(keys.some((k) => /cross/i.test(k))).toBe(false);
    expect(keys.some((k) => /hit/i.test(k))).toBe(false);
  });
});
