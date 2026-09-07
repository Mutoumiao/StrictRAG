import { jsonb, pgTable, uuid, varchar } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

export type KbSettingsAuditDiff = Record<string, { from: unknown; to: unknown }>;

/**
 * 知识库设置修改日志（最小可查询行）。
 * PATCH settings 成功且 diff 非空时插入；不含密钥 / τ / API Key。
 */
export const kbSettingsAudits = pgTable('kb_settings_audits', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  actorUserId: varchar('actor_user_id', { length: 64 }).notNull(),
  diffJson: jsonb('diff_json').$type<KbSettingsAuditDiff>().notNull(),
});
