import type { IngestReportConflictPair, IngestReportItem } from '@strict-rag/contracts';
import { ingestReports } from '@strict-rag/db';
import { desc, eq } from 'drizzle-orm';

import { getDb } from './db.js';

export function toIngestReportItem(row: {
  id: string;
  kbId: string;
  docId: string;
  indexVersion: number;
  chunkCount: number;
  internalDropped: number;
  crossDocDropped: number;
  dedupeCrossDocRate: number | null;
  conflictPairs: IngestReportConflictPair[] | null;
  contextSource: string | null;
  contextualizeL1Ok: number | null;
  contextualizeL0Fallback: number | null;
  dualReady: number;
  embedReady: number;
  esReady: number;
  reconcileOk: number | null;
  reconcileMissing: number | null;
  reconcileOrphan: number | null;
  createdAt: string | null;
}): IngestReportItem {
  const reconcile =
    row.reconcileOk == null
      ? null
      : {
          ok: row.reconcileOk === 1,
          missingCount: row.reconcileMissing ?? 0,
          orphanCount: row.reconcileOrphan ?? 0,
        };
  return {
    id: row.id,
    kbId: row.kbId,
    docId: row.docId,
    indexVersion: row.indexVersion,
    chunkCount: row.chunkCount,
    internalDropped: row.internalDropped,
    crossDocDropped: row.crossDocDropped,
    // 落库快照原样回读：NULL（分母为 0 / 迁移前旧行）不得改写成 0
    dedupeCrossDocRate: row.dedupeCrossDocRate ?? null,
    conflictPairs: row.conflictPairs ?? [],
    contextSource:
      row.contextSource === 'l0' ||
      row.contextSource === 'l0_fallback' ||
      row.contextSource === 'l1_llm'
        ? row.contextSource
        : null,
    // 同上：NULL = 迁移前旧行未记录，不得改写成 0
    contextualizeL1Ok: row.contextualizeL1Ok ?? null,
    contextualizeL0Fallback: row.contextualizeL0Fallback ?? null,
    dualReady: row.dualReady === 1,
    embedReady: row.embedReady === 1,
    esReady: row.esReady === 1,
    reconcile,
    createdAt: row.createdAt,
  };
}

export type IngestReportRepo = {
  listByKb(kbId: string): Promise<IngestReportItem[]>;
};

export const ingestReportsRepo: IngestReportRepo = {
  async listByKb(kbId) {
    const rows = await getDb()
      .select({
        id: ingestReports.id,
        kbId: ingestReports.kbId,
        docId: ingestReports.docId,
        indexVersion: ingestReports.indexVersion,
        chunkCount: ingestReports.chunkCount,
        internalDropped: ingestReports.internalDropped,
        crossDocDropped: ingestReports.crossDocDropped,
        dedupeCrossDocRate: ingestReports.dedupeCrossDocRate,
        conflictPairs: ingestReports.conflictPairs,
        contextSource: ingestReports.contextSource,
        contextualizeL1Ok: ingestReports.contextualizeL1Ok,
        contextualizeL0Fallback: ingestReports.contextualizeL0Fallback,
        dualReady: ingestReports.dualReady,
        embedReady: ingestReports.embedReady,
        esReady: ingestReports.esReady,
        reconcileOk: ingestReports.reconcileOk,
        reconcileMissing: ingestReports.reconcileMissing,
        reconcileOrphan: ingestReports.reconcileOrphan,
        createdAt: ingestReports.createdAt,
      })
      .from(ingestReports)
      .where(eq(ingestReports.kbId, kbId))
      .orderBy(desc(ingestReports.createdAt));
    return rows.map(toIngestReportItem);
  },
};
