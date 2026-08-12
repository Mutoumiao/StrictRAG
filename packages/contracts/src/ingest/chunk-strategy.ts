/**
 * 分片策略码 SSOT（B12 / ADR-053）。
 * api 注册表与 worker 执行集合必须对齐：**可执行 ⊆ 已实现**。
 */

export const CHUNK_STRATEGY_CODES = {
  STRUCTURE_PARAGRAPH: 'structure_paragraph',
  FIXED_WINDOW: 'fixed_window',
  HEADING_SECTIONS: 'heading_sections',
} as const;

export type ChunkStrategyCode =
  (typeof CHUNK_STRATEGY_CODES)[keyof typeof CHUNK_STRATEGY_CODES];

/** 默认策略（唯一当前实现） */
export const DEFAULT_CHUNK_STRATEGY = CHUNK_STRATEGY_CODES.STRUCTURE_PARAGRAPH;

/**
 * worker **已实现**、允许写入 `documents.chunk_strategy` 并执行 chunk 的码。
 * 增策略时：先 worker 实现 + 测，再扩本数组，再开 api 写入。
 */
export const IMPLEMENTED_CHUNK_STRATEGIES = [
  CHUNK_STRATEGY_CODES.STRUCTURE_PARAGRAPH,
] as const satisfies readonly ChunkStrategyCode[];

const IMPLEMENTED_SET = new Set<string>(IMPLEMENTED_CHUNK_STRATEGIES);

export function isImplementedChunkStrategy(code: string): boolean {
  return IMPLEMENTED_SET.has(code);
}

/** 产品已知 / roadmap 码（含尚未实现）；非写入许可 */
export const KNOWN_CHUNK_STRATEGY_CODES = [
  CHUNK_STRATEGY_CODES.STRUCTURE_PARAGRAPH,
  CHUNK_STRATEGY_CODES.FIXED_WINDOW,
  CHUNK_STRATEGY_CODES.HEADING_SECTIONS,
] as const satisfies readonly ChunkStrategyCode[];
