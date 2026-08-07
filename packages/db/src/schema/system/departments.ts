import { integer, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 部门组织树（ADR-057 / B5 组织壳）。
 * path：物化路径 `/id1/id2/`，便于子树查询；禁环由应用层校验。
 */
export const departments = pgTable(
  'departments',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    code: text('code'),
    /** 物化路径，如 /uuid/uuid/ */
    path: text('path').notNull().default('/'),
    sort: integer('sort').notNull().default(0),
    /** active | disabled */
    status: text('status').notNull().default('active'),
  },
  (t) => [uniqueIndex('departments_tenant_code_uidx').on(t.tenantId, t.code)],
);

/**
 * 用户 ↔ 部门（主部门 + 兼任 + 负责人）。
 * 有归属时 is_primary 恰为 1 条（应用层校验）。
 */
export const userDepartments = pgTable(
  'user_departments',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    deptId: uuid('dept_id').notNull(),
    /** 1=主部门 0=兼任 */
    isPrimary: integer('is_primary').notNull().default(0),
    /** 1=部门负责人 */
    isLeader: integer('is_leader').notNull().default(0),
    title: text('title'),
  },
  (t) => [uniqueIndex('user_departments_user_dept_uidx').on(t.userId, t.deptId)],
);
