import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 冻结的 chunkId 清单（doc_id + index_version）。
 * ADR-038：物化后不可静默改写；对账用 chunk_ids。
 */
export const chunkManifests = pgTable('chunk_manifests', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  docId: uuid('doc_id').notNull(),
  indexVersion: integer('index_version').notNull(),
  /** 冻结后的 chunk id 有序列表 */
  chunkIds: jsonb('chunk_ids').$type<string[]>().notNull(),
  frozen: integer('frozen').notNull().default(1),
  strategy: text('strategy'),
});
