import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

import { formatLocalDateTime } from '../../time.js';

/**
 * 平台分片策略注册表（ADR-053 第一层）。
 * 种子来自 contracts CHUNK_STRATEGY_PLATFORM_SEED；写入闸仍看 IMPLEMENTED_*。
 */
export const chunkStrategyDefinitions = pgTable('chunk_strategy_definitions', {
  code: text('code').primaryKey().notNull(),
  name: text('name').notNull(),
  docFamilies: jsonb('doc_families').$type<string[]>().notNull(),
  paramSchema: jsonb('param_schema').$type<Record<string, unknown>>().notNull(),
  pipelineId: text('pipeline_id').notNull(),
  implemented: boolean('implemented').notNull().default(false),
  system: boolean('system').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'string', precision: 0 }).$defaultFn(() =>
    formatLocalDateTime(),
  ),
  updatedAt: timestamp('updated_at', { mode: 'string', precision: 0 })
    .$defaultFn(() => formatLocalDateTime())
    .$onUpdate(() => formatLocalDateTime()),
});
