import { jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 运营黄金集题面（P2 评测底线）。
 * case_key 跨 run 稳定；与工程 fixtures/l1/gold.yaml 分离。
 */
export const goldQuestions = pgTable(
  'gold_questions',
  {
    ...baseColumns,
    tenantId: uuid('tenant_id').notNull(),
    kbId: uuid('kb_id').notNull(),
    /** 稳定题号，跨 run 不变 */
    caseKey: text('case_key').notNull(),
    question: text('question').notNull(),
    /** answerable | unanswerable | false_premise */
    type: text('type').notNull(),
    expectedDocIds: jsonb('expected_doc_ids').$type<string[] | null>(),
    expectedChunkIds: jsonb('expected_chunk_ids').$type<string[] | null>(),
    rubric: text('rubric'),
  },
  (t) => [uniqueIndex('gold_questions_kb_case_uidx').on(t.kbId, t.caseKey)],
);
