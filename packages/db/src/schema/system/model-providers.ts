import { integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';

import { baseColumns } from '../_shard/base-columns.js';

/**
 * 模型供应商（ADR-055 生产端）。
 * api_key_enc：服务端持有；GET 映射为 hasApiKey，永不回显明文。
 */
export type ModelProviderModelRow = {
  name: string;
  type: 'llm' | 'embedding' | 'rerank';
  enabled: boolean;
  dimensions?: number;
};

export const modelProviders = pgTable('model_providers', {
  ...baseColumns,
  tenantId: uuid('tenant_id').notNull(),
  name: text('name').notNull(),
  presetKey: text('preset_key').notNull(),
  baseUrl: text('base_url').notNull(),
  /** 只写密钥；对外 DTO 禁止直出 */
  apiKeyEnc: text('api_key_enc'),
  timeoutMs: integer('timeout_ms').notNull().default(60_000),
  /** 1=enabled 0=disabled（与既有 text 旗标风格兼容，用 integer 便于索引） */
  enabled: integer('enabled').notNull().default(1),
  notes: text('notes'),
  modelsJson: jsonb('models_json').$type<ModelProviderModelRow[]>().notNull().default([]),
});
