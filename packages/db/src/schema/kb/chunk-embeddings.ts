import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 向量存储。P1 mock 用 float[] JSON；生产可换 pgvector 列。
 */
export const chunkEmbeddings = pgTable('chunk_embeddings', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  docId: uuid('doc_id').notNull(),
  chunkId: uuid('chunk_id').notNull(),
  indexVersion: integer('index_version').notNull(),
  model: text('model').notNull(),
  dims: integer('dims').notNull(),
  embedding: jsonb('embedding').$type<number[]>().notNull(),
});
