import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 文档元数据 + 索引状态机 + 业务 lifecycle。
 * 规格：prds/03-data/01-postgresql-schema.md · ADR-038/039/043/048
 */
export const documents = pgTable('documents', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  kbId: uuid('kb_id').notNull(),
  title: text('title').notNull(),

  /** 索引管线状态 */
  status: text('status').notNull().default('uploaded'),
  /** 审批：none | pending | approved | rejected */
  approvalStatus: text('approval_status').notNull().default('none'),
  /** 业务态：draft | active | superseded | archived；默认 draft */
  lifecycle: text('lifecycle').notNull().default('draft'),

  sourceType: text('source_type').notNull().default('upload'),
  objectBucket: text('object_bucket'),
  objectKey: text('object_key'),
  contentType: text('content_type'),
  byteSize: integer('byte_size'),
  checksumSha256: text('checksum_sha256'),

  /** 解析正文：P1 mock 可写本地/PG 文本；生产落 Mongo */
  parsedText: text('parsed_text'),
  mongoDocId: text('mongo_doc_id'),
  extractMethod: text('extract_method'),

  indexVersion: integer('index_version').notNull().default(0),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),

  uploadedBy: uuid('uploaded_by'),
  approvedBy: uuid('approved_by'),
  approvedAt: text('approved_at'),

  docType: text('doc_type'),
  chunkStrategy: text('chunk_strategy').default('structure_paragraph'),
  chunkStrategyParams: jsonb('chunk_strategy_params').$type<Record<string, unknown>>(),

  /** 双就绪标记（ADR-038） */
  embedReady: integer('embed_ready').notNull().default(0),
  esReady: integer('es_ready').notNull().default(0),

  /** P3b-META：可空 = 库级；强制隔离未接 */
  ownerDeptId: uuid('owner_dept_id'), // 可空 = 库级
  visibilityLevel: integer('visibility_level').notNull().default(20),

  effectiveFrom: text('effective_from'),
  effectiveTo: text('effective_to'),
  supersedesDocId: uuid('supersedes_doc_id'),
  supersededByDocId: uuid('superseded_by_doc_id'),
});
