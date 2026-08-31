import { pgTable, text } from 'drizzle-orm/pg-core';

/**
 * 权限码字典（ADR-056 启动 upsert）。
 * kind 存 catalog 原值（含 page+action），不把 PRD 二分枚举盖过 admin-catalog。
 * 运行时求值仍走 platform_roles.codes_json，不切到本表。
 */
export const permissionDefinitions = pgTable('permission_definitions', {
  code: text('code').primaryKey().notNull(),
  kind: text('kind').notNull(),
  scope: text('scope').notNull(),
  description: text('description').notNull(),
  source: text('source').notNull(),
});
