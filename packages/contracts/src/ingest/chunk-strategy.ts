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

/** ADR-053 文档族；P2 不含 pdf_scan（OCR 在 P5） */
export const CHUNK_STRATEGY_DOC_FAMILIES = ['md', 'txt', 'docx', 'pdf_text'] as const;
export type ChunkStrategyDocFamily = (typeof CHUNK_STRATEGY_DOC_FAMILIES)[number];

export const DEFAULT_CHUNK_STRATEGY_PARAMS = {
  chunkTokens: 256,
  chunkOverlap: 32,
  contextMode: 'l1_llm',
} as const;

const TEXT_FAMILIES: ChunkStrategyDocFamily[] = ['md', 'txt', 'docx', 'pdf_text'];

/** 平台注册表种子（表权威；本常量只用于迁移/启动种子，禁止当写入闸） */
export const CHUNK_STRATEGY_PLATFORM_SEED = [
  {
    code: CHUNK_STRATEGY_CODES.STRUCTURE_PARAGRAPH,
    name: '结构段落',
    docFamilies: TEXT_FAMILIES,
    paramSchema: { ...DEFAULT_CHUNK_STRATEGY_PARAMS },
    pipelineId: 'ingest-chunk',
    implemented: true,
    system: true,
  },
  {
    code: CHUNK_STRATEGY_CODES.FIXED_WINDOW,
    name: '固定窗口',
    docFamilies: TEXT_FAMILIES,
    paramSchema: { ...DEFAULT_CHUNK_STRATEGY_PARAMS },
    pipelineId: 'ingest-chunk',
    implemented: false,
    system: true,
  },
  {
    code: CHUNK_STRATEGY_CODES.HEADING_SECTIONS,
    name: '标题分节',
    docFamilies: ['md'] satisfies ChunkStrategyDocFamily[],
    paramSchema: { ...DEFAULT_CHUNK_STRATEGY_PARAMS },
    pipelineId: 'ingest-chunk',
    implemented: false,
    system: true,
  },
] as const;

export function docFamilyFromContentType(contentType: string): ChunkStrategyDocFamily {
  const ct = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  if (ct === 'text/markdown' || ct === 'text/x-markdown') return 'md';
  if (ct.includes('wordprocessingml') || ct === 'application/msword') return 'docx';
  if (ct === 'application/pdf') return 'pdf_text';
  return 'txt';
}
