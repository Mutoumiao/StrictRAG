import { integer, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 平台角色（ADR-056 / B4）。
 * codes_json：权限码数组，须 ⊆ admin-catalog。
 * is_system=1：种子角色，禁止删改 code。
 */
export const platformRoles = pgTable(
  'platform_roles',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    /** 1=系统种子 0=自定义 */
    isSystem: integer('is_system').notNull().default(0),
    /** 1=enabled 0=disabled */
    enabled: integer('enabled').notNull().default(1),
    codesJson: jsonb('codes_json').$type<string[]>().notNull().default([]),
  },
  (t) => [uniqueIndex('platform_roles_tenant_code_uidx').on(t.tenantId, t.code)],
);

/**
 * 用户 ↔ 角色（多对多）。
 */
export const userRoles = pgTable(
  'user_roles',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    userId: uuid('user_id').notNull(),
    roleId: uuid('role_id').notNull(),
  },
  (t) => [uniqueIndex('user_roles_user_role_uidx').on(t.userId, t.roleId)],
);
