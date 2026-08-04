import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 知识库元数据。
 * config_json 可含 docTypes / allowedModes 等；P1 不做完整设置 API。
 */
export const knowledgeBases = pgTable('knowledge_bases', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  configJson: jsonb('config_json').$type<Record<string, unknown>>().default({}),
});
