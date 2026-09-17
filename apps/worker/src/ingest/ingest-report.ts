/**
 * 入库报告最小落库。失败只 warn，不阻断状态机。
 */

import type { ContextSource } from '@strict-rag/contracts';
import { ingestReports, type Db, type IngestReportConflictPair } from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { logger } from '../logger.js';

export type ReconcileSnapshot = {
  ok: boolean;
  missing: readonly string[];
  orphan: readonly string[];
};

export type IngestReportSnapshot = {
  tenantId: string;
  kbId: string;
  docId: string;
  indexVersion: number;
  chunkCount: number;
  internalDropped: number;
  crossDocDropped: number;
  conflictPairs: readonly IngestReportConflictPair[];
  contextSource?: ContextSource | null;
  /** PRD 04 §5.2 `contextualize_l1_ok`；缺省/未记录 = null */
  contextualizeL1Ok?: number | null;
  /** PRD 04 §5.2 `contextualize_l0_fallback`；缺省/未记录 = null */
  contextualizeL0Fallback?: number | null;
  dualReady: boolean;
  embedReady: boolean;
  esReady: boolean;
  reconcile: ReconcileSnapshot | null;
};

export function flag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
}

/**
 * 跨文档去重率（PRD 04 §5.2 `dedupe_cross_doc_rate`）。
 * 口径由本仓钉（PRD 只给指标名）：分母 = 本轮**参与去重的切片总数** = 存活 + 文档内丢弃 + 跨文档丢弃。
 * 分母为 0（本轮没有可去重切片）→ **null**，不得写 0 假装「零重复」。
 */
export function dedupeCrossDocRate(snapshot: {
  chunkCount: number;
  internalDropped: number;
  crossDocDropped: number;
}): number | null {
  const total = snapshot.chunkCount + snapshot.internalDropped + snapshot.crossDocDropped;
  if (total <= 0) return null;
  return snapshot.crossDocDropped / total;
}

function keepContextSource(
  existing: string | null | undefined,
  snapshot: ContextSource | null | undefined,
): ContextSource | null {
  if (existing === 'l0' || existing === 'l0_fallback' || existing === 'l1_llm') return existing;
  if (snapshot === 'l0' || snapshot === 'l0_fallback' || snapshot === 'l1_llm') return snapshot;
  return null;
}

export function buildIngestReportInsert(snapshot: IngestReportSnapshot) {
  return {
    id: uuidv7(),
    tenantId: snapshot.tenantId,
    kbId: snapshot.kbId,
    docId: snapshot.docId,
    indexVersion: snapshot.indexVersion,
    chunkCount: snapshot.chunkCount,
    internalDropped: snapshot.internalDropped,
    crossDocDropped: snapshot.crossDocDropped,
    // 由同一份计数派生：不会出现「rate 与计数不一致」的行
    dedupeCrossDocRate: dedupeCrossDocRate(snapshot),
    conflictPairs: [...snapshot.conflictPairs],
    contextSource: snapshot.contextSource ?? null,
    contextualizeL1Ok: snapshot.contextualizeL1Ok ?? null,
    contextualizeL0Fallback: snapshot.contextualizeL0Fallback ?? null,
    dualReady: flag(snapshot.dualReady),
    embedReady: flag(snapshot.embedReady),
    esReady: flag(snapshot.esReady),
    reconcileOk: snapshot.reconcile == null ? null : flag(snapshot.reconcile.ok),
    reconcileMissing: snapshot.reconcile == null ? null : snapshot.reconcile.missing.length,
    reconcileOrphan: snapshot.reconcile == null ? null : snapshot.reconcile.orphan.length,
  };
}

export function buildIngestReportPatch(snapshot: IngestReportSnapshot) {
  const row = buildIngestReportInsert(snapshot);
  return {
    chunkCount: row.chunkCount,
    internalDropped: row.internalDropped,
    crossDocDropped: row.crossDocDropped,
    dedupeCrossDocRate: row.dedupeCrossDocRate,
    conflictPairs: row.conflictPairs,
    contextSource: row.contextSource,
    contextualizeL1Ok: row.contextualizeL1Ok,
    contextualizeL0Fallback: row.contextualizeL0Fallback,
    dualReady: row.dualReady,
    embedReady: row.embedReady,
    esReady: row.esReady,
    reconcileOk: row.reconcileOk,
    reconcileMissing: row.reconcileMissing,
    reconcileOrphan: row.reconcileOrphan,
  };
}

export async function persistIngestReport(db: Db, snapshot: IngestReportSnapshot): Promise<void> {
  try {
    const existing = await db
      .select({
        id: ingestReports.id,
        internalDropped: ingestReports.internalDropped,
        crossDocDropped: ingestReports.crossDocDropped,
        conflictPairs: ingestReports.conflictPairs,
        contextSource: ingestReports.contextSource,
        contextualizeL1Ok: ingestReports.contextualizeL1Ok,
        contextualizeL0Fallback: ingestReports.contextualizeL0Fallback,
      })
      .from(ingestReports)
      .where(
        and(
          eq(ingestReports.docId, snapshot.docId),
          eq(ingestReports.indexVersion, snapshot.indexVersion),
        ),
      )
      .limit(1);
    const merged: IngestReportSnapshot = {
      ...snapshot,
      internalDropped: existing[0]?.internalDropped ?? snapshot.internalDropped,
      crossDocDropped: existing[0]?.crossDocDropped ?? snapshot.crossDocDropped,
      conflictPairs: existing[0]?.conflictPairs ?? snapshot.conflictPairs,
      contextSource: keepContextSource(existing[0]?.contextSource, snapshot.contextSource),
      // 已记录值不被后阶段（embed / es_index）的空快照复写
      contextualizeL1Ok: existing[0]?.contextualizeL1Ok ?? snapshot.contextualizeL1Ok ?? null,
      contextualizeL0Fallback:
        existing[0]?.contextualizeL0Fallback ?? snapshot.contextualizeL0Fallback ?? null,
    };
    if (existing[0]) {
      await db
        .update(ingestReports)
        .set(buildIngestReportPatch(merged))
        .where(eq(ingestReports.id, existing[0].id));
      return;
    }
    await db.insert(ingestReports).values(buildIngestReportInsert(merged));
  } catch (err) {
    logger.warn(
      { err, docId: snapshot.docId, indexVersion: snapshot.indexVersion },
      'ingest_reports persist failed (non-blocking)',
    );
  }
}
