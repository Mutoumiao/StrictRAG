import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/** 入库任务摘要 */
export const ingestJobs = pgTable('ingest_jobs', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  docId: uuid('doc_id').notNull(),
  queue: text('queue').notNull(),
  jobName: text('job_name').notNull(),
  status: text('status').notNull().default('queued'),
  indexVersion: integer('index_version'),
  errorMessage: text('error_message'),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
});
