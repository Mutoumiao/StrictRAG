import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/** chunk 元数据；body 权威在 Mongo，P1 可用 body_text 落 PG 演示 */
export const chunks = pgTable('chunks', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  docId: uuid('doc_id').notNull(),
  indexVersion: integer('index_version').notNull(),
  ordinal: integer('ordinal').notNull(),
  preview: text('preview'),
  bodyText: text('body_text'),
  contextPrefix: text('context_prefix'),
  tokenCount: integer('token_count'),
  mongoBodyId: text('mongo_body_id'),
  meta: jsonb('meta').$type<Record<string, unknown>>().default({}),
});
