import { pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 单一 users 表（ADR-030）。
 * 本地账密可选；OIDC 时 password_hash 可空。
 */
export const users = pgTable('users', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  email: text('email').notNull(),
  displayName: text('display_name'),
  passwordHash: text('password_hash'),
  /** platform_admin | user（兼容锚点） */
  platformRole: text('platform_role').notNull().default('user'),
  /** active | disabled */
  status: text('status').notNull().default('active'),
  /** admin 运营账号标记（可选） */
  isPlatformOperator: text('is_platform_operator').notNull().default('0'),
});
