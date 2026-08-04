import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 用户反馈（薄路径）。
 * request_id 关联 ask_traces.request_id。
 */
export const askFeedback = pgTable('ask_feedback', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  userId: uuid('user_id').notNull(),
  requestId: text('request_id').notNull(),
  rating: text('rating'),
  category: text('category'),
  comment: text('comment'),
  /** open | dismissed | linked_doc | queued_reindex | promoted_to_gold */
  status: text('status').notNull().default('open'),
  handlerId: uuid('handler_id'),
  resolvedAt: text('resolved_at'),
});
