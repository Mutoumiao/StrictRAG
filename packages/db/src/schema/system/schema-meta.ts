import { pgTable, text } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * Phase 0 系统占位表：验证 migrate 路径与 baseColumns。
 * 业务 KB/文档表属 Phase 1。
 */
export const schemaMeta = pgTable('schema_meta', {
  ...baseColumns,
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
});
