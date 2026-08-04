import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 问答会话线程（P2 壳；rewrite 默认关）。
 */
export const askSessions = pgTable('ask_sessions', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  userId: uuid('user_id').notNull(),
  title: text('title'),
  /** open | closed */
  status: text('status').notNull().default('open'),
});
