import { pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * KB 成员（P2）。
 * role: read | write | admin（库内锚点；运行时授权以权限码为准）。
 */
export const kbMembers = pgTable(
  'kb_members',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    kbId: uuid('kb_id').notNull(),
    userId: uuid('user_id').notNull(),
    role: text('role').notNull().default('read'),
  },
  (t) => [uniqueIndex('kb_members_kb_user_uidx').on(t.kbId, t.userId)],
);
