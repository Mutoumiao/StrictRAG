import { integer, jsonb, pgTable, real, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

export type EvidenceSnapshotItem = {
  chunkId: string;
  docId: string;
  lifecycle?: string;
  preview?: string;
  title?: string;
};

/**
 * 问答摘要 + evidence 快照。
 * evidence_snapshot 仅 KB chunk 元数据，禁止会话原文。
 */
export const askTraces = pgTable('ask_traces', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  userId: uuid('user_id').notNull(),
  /** 可选 FK ask_sessions.id */
  sessionId: uuid('session_id'),
  /** 业务 requestId（与响应 requestId 对齐；可与 id 相同或独立） */
  requestId: text('request_id').notNull(),
  status: text('status').notNull(),
  reason: text('reason').notNull(),
  minSupport: real('min_support'),
  latencyMs: integer('latency_ms'),
  mode: text('mode'),
  rawQuestion: text('raw_question').notNull(),
  standaloneQuestion: text('standalone_question'),
  rewriteUsed: integer('rewrite_used').notNull().default(0),
  sessionDeepened: integer('session_deepened').notNull().default(0),
  answer: text('answer'),
  configSnap: jsonb('config_snap').$type<Record<string, unknown>>(),
  graphTrace: jsonb('graph_trace').$type<Record<string, unknown>>(),
  evidenceSnapshot: jsonb('evidence_snapshot').$type<EvidenceSnapshotItem[]>().default([]),
  langfuseTraceId: text('langfuse_trace_id'),
});
