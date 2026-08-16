import { integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 跨部门授权（ADR-057 / P3b-GRANT）。
 * 表可存可回读；检索零读本表。granted_at 复用 created_at，不另开时间列。
 * 唯一：(user_id, dept_id) 普通唯一索引；过期后再授 = 先 DELETE 再 POST。
 */
export const deptCrossGrants = pgTable(
  'dept_cross_grants',
  {
    ...baseColumns,
    userId: uuid('user_id').notNull(),
    deptId: uuid('dept_id').notNull(),
    /** 10 / 20 / 30 / 40 */
    maxVisibilityLevel: integer('max_visibility_level').notNull(),
    expiresAt: timestamp('expires_at', { mode: 'string', precision: 0 }),
    reason: text('reason'),
    grantedBy: uuid('granted_by'),
  },
  (t) => [uniqueIndex('dept_cross_grants_user_dept_uidx').on(t.userId, t.deptId)],
);
