import { integer, jsonb, pgTable, real, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * L1 / 评测 run 账本（B10-followup）。
 * 放行以本表 + 报告为准；Langfuse 不单独放行。
 */
export const evalRuns = pgTable('eval_runs', {
  ...baseColumns,
  tenantId: uuid('tenant_id'),
  kbId: uuid('kb_id').notNull(),
  /** golden_2x2 | verifier_calib | tau_sweep | session_multiturn */
  runType: text('run_type').notNull().default('golden_2x2'),
  /** mock | live | unknown — 与 L1 retrieve_mode 对齐 */
  retrieveMode: text('retrieve_mode').notNull(),
  /** 仅 live 可为 true；业务签字另须人审 + B3-W 后重跑 */
  signoffEligible: text('signoff_eligible').notNull().default('0'),
  goldPath: text('gold_path'),
  caseCount: integer('case_count').notNull().default(0),
  matrixA: integer('matrix_a').notNull().default(0),
  matrixB: integer('matrix_b').notNull().default(0),
  matrixC: integer('matrix_c').notNull().default(0),
  matrixD: integer('matrix_d').notNull().default(0),
  coverage: real('coverage'),
  errorCount: integer('error_count').notNull().default(0),
  ranAt: text('ran_at').notNull(),
  /** 完整 L1Report 快照 */
  reportJson: jsonb('report_json'),
  notes: text('notes'),
});
