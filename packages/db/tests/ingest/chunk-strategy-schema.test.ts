/**
 * 目标：分片策略三层表必须暴露平台定义与库启用列。
 * 需求：功能表 §4.5 · ADR-053
 * 被测：chunkStrategyDefinitions · kbChunkStrategies
 * 简介：核对 code / docFamilies / recommendedFamilies；不含平台 CRUD。
 */

import { describe, expect, it } from 'vitest';

import { chunkStrategyDefinitions, kbChunkStrategies } from '../../src/schema/index.js';

describe('chunk strategy layer schema', () => {
  it('definitions 以 code 为主键并含 docFamilies / paramSchema', () => {
    expect(chunkStrategyDefinitions.code.name).toBe('code');
    expect(chunkStrategyDefinitions.docFamilies.name).toBe('doc_families');
    expect(chunkStrategyDefinitions.paramSchema.name).toBe('param_schema');
    expect(chunkStrategyDefinitions.implemented.name).toBe('implemented');
  });

  it('kb_chunk_strategies 含启用与 recommendedFamilies', () => {
    expect(kbChunkStrategies.kbId.name).toBe('kb_id');
    expect(kbChunkStrategies.code.name).toBe('code');
    expect(kbChunkStrategies.enabled.name).toBe('enabled');
    expect(kbChunkStrategies.recommendedFamilies.name).toBe('recommended_families');
    expect(kbChunkStrategies.paramOverrides.name).toBe('param_overrides');
  });
});
