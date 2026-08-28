import { boolean, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 库启用的分片策略（ADR-053 第二层）。
 * recommendedFamilies = 该 code 作为 recommended 的 MIME 族。
 */
export const kbChunkStrategies = pgTable(
  'kb_chunk_strategies',
  {
    ...baseColumns,
    kbId: uuid('kb_id').notNull(),
    code: text('code').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    paramOverrides: jsonb('param_overrides').$type<Record<string, unknown> | null>(),
    recommendedFamilies: jsonb('recommended_families').$type<string[]>().notNull(),
  },
  (t) => [uniqueIndex('kb_chunk_strategies_kb_code_uidx').on(t.kbId, t.code)],
);
