import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * purpose → ModelRef 绑定（ADR-055 消费端）。
 * scope=platform 时 scope_id 为空串；scope=kb 时为 kbId（本切片仅写 platform）。
 */
export const modelBindings = pgTable(
  'model_bindings',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    /** platform | kb */
    scope: text('scope').notNull(),
    /** platform 用 ''；kb 用 kb uuid */
    scopeId: text('scope_id').notNull().default(''),
    purpose: text('purpose').notNull(),
    primaryRef: text('primary_ref').notNull(),
    fallbackRefs: jsonb('fallback_refs').$type<string[]>().notNull().default([]),
  },
  (t) => [
    uniqueIndex('model_bindings_scope_purpose_uidx').on(
      t.tenantId,
      t.scope,
      t.scopeId,
      t.purpose,
    ),
  ],
);
