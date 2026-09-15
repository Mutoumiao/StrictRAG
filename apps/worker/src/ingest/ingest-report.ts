/**
 * 入库报告最小落库。失败只 warn，不阻断状态机。
 */

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
  dualReady: boolean;
  embedReady: boolean;
  esReady: boolean;
  reconcile: ReconcileSnapshot | null;
};

export function flag(value: boolean): 0 | 1 {
  return value ? 1 : 0;
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
    conflictPairs: [...snapshot.conflictPairs],
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
    conflictPairs: row.conflictPairs,
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
