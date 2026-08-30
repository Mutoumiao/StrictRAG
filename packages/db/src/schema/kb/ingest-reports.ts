import { integer, pgTable, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 入库报告（最小可查询行）。
 * 按 doc + indexVersion 一版；不含跨 doc / L1 / Hit@k。
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
    dualReady: integer('dual_ready').notNull(),
    embedReady: integer('embed_ready').notNull(),
    esReady: integer('es_ready').notNull(),
    reconcileOk: integer('reconcile_ok'),
    reconcileMissing: integer('reconcile_missing'),
    reconcileOrphan: integer('reconcile_orphan'),
  },
  (t) => [uniqueIndex('ingest_reports_doc_version_uidx').on(t.docId, t.indexVersion)],
);
