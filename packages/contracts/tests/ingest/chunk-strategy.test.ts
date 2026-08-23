/**
 * 目标：分片策略默认码必须已实现，路线图码已知但未实现，未知码不得当已实现。
 * 需求：B12
 * 被测：DEFAULT_CHUNK_STRATEGY · isImplementedChunkStrategy · CHUNK_STRATEGY_CODES
 * 简介：策略枚举与未实现边界。
 */

import { describe, expect, it } from 'vitest';

import {
  CHUNK_STRATEGY_CODES,
  DEFAULT_CHUNK_STRATEGY,
  IMPLEMENTED_CHUNK_STRATEGIES,
  isImplementedChunkStrategy,
  KNOWN_CHUNK_STRATEGY_CODES,
} from '../../src/ingest/chunk-strategy.js';

describe('chunk-strategy SSOT · X-03', () => {
  it('default is structure_paragraph and is implemented', () => {
    expect(DEFAULT_CHUNK_STRATEGY).toBe(CHUNK_STRATEGY_CODES.STRUCTURE_PARAGRAPH);
    expect(isImplementedChunkStrategy(DEFAULT_CHUNK_STRATEGY)).toBe(true);
  });

  it('implemented ⊆ known', () => {
    for (const code of IMPLEMENTED_CHUNK_STRATEGIES) {
      expect(KNOWN_CHUNK_STRATEGY_CODES).toContain(code);
      expect(isImplementedChunkStrategy(code)).toBe(true);
    }
  });

  it('roadmap codes are known but not implemented', () => {
    expect(isImplementedChunkStrategy(CHUNK_STRATEGY_CODES.FIXED_WINDOW)).toBe(false);
    expect(isImplementedChunkStrategy(CHUNK_STRATEGY_CODES.HEADING_SECTIONS)).toBe(false);
    expect(KNOWN_CHUNK_STRATEGY_CODES).toContain(CHUNK_STRATEGY_CODES.FIXED_WINDOW);
  });

  it('unknown code is not implemented', () => {
    expect(isImplementedChunkStrategy('no_such_strategy')).toBe(false);
  });
});
