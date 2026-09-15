import { integer, jsonb, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

export type IngestReportConflictPair = {
  otherDocId: string;
  otherChunkId: string;
  action: 'skip_index';
};

/**
 * 入库报告（可查询行）。
 * 按 doc + indexVersion 一版；含跨 doc skip 计数与冲突对；不含 pending_review / Hit@k。
 */
export const ingestReports = pgTable(
  'ingest_reports',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    kbId: uuid('kb_id').notNull(),
    docId: uuid('doc_id').notNull(),
    indexVersion: integer('index_version').notNull(),
    chunkCount: integer('chunk_count').notNull(),
    internalDropped: integer('internal_dropped').notNull(),
    crossDocDropped: integer('cross_doc_dropped').notNull(),
    conflictPairs: jsonb('conflict_pairs').$type<IngestReportConflictPair[]>().notNull(),
    dualReady: integer('dual_ready').notNull(),
    embedReady: integer('embed_ready').notNull(),
    esReady: integer('es_ready').notNull(),
    reconcileOk: integer('reconcile_ok'),
    reconcileMissing: integer('reconcile_missing'),
    reconcileOrphan: integer('reconcile_orphan'),
  },
  (t) => [uniqueIndex('ingest_reports_doc_version_uidx').on(t.docId, t.indexVersion)],
);
