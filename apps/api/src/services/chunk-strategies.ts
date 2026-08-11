/**
 * B12 / ADR-053：分片策略注册表（最小）。
 * 上传/reindex 须选已注册策略；旧文档保留既有 strategy，不因注册表变更自动切换。
 */

export type ChunkStrategyDef = {
  code: string;
  name: string;
  /** 是否系统种子（不可从注册表删除） */
  system: boolean;
};

/** 已注册策略（进程内 SSOT；后续可扩 DB） */
const REGISTRY = new Map<string, ChunkStrategyDef>([
  [
    'structure_paragraph',
    { code: 'structure_paragraph', name: '结构段落', system: true },
  ],
  [
    'fixed_window',
    { code: 'fixed_window', name: '固定窗口', system: true },
  ],
  [
    'heading_sections',
    { code: 'heading_sections', name: '标题分节', system: true },
  ],
]);

export const DEFAULT_CHUNK_STRATEGY = 'structure_paragraph';

export function listChunkStrategies(): ChunkStrategyDef[] {
  return [...REGISTRY.values()];
}

export function isRegisteredChunkStrategy(code: string): boolean {
  return REGISTRY.has(code);
}

/**
 * 解析必选策略：
 * - 传入 code → 必须已注册
 * - 未传 → 默认 structure_paragraph（单策略兼容；多策略环境仍应显式传）
 */
export function resolveRequiredChunkStrategy(
  requested: string | null | undefined,
): { ok: true; code: string } | { ok: false; message: string } {
  const code = (requested ?? DEFAULT_CHUNK_STRATEGY).trim();
  if (!code) {
    return { ok: false, message: 'chunkStrategy is required' };
  }
  if (!isRegisteredChunkStrategy(code)) {
    return {
      ok: false,
      message: `unknown chunkStrategy: ${code} (registered: ${[...REGISTRY.keys()].join(',')})`,
    };
  }
  return { ok: true, code };
}

/**
 * 旧文档不自动切：仅当 explicit 新策略且与当前不同才返回「可改」；
 * 自动/隐式路径应调用本函数并拒绝静默覆盖。
 */
export function shouldRetainExistingStrategy(params: {
  existing: string | null | undefined;
  next: string;
  explicitChange: boolean;
}): boolean {
  const cur = params.existing ?? DEFAULT_CHUNK_STRATEGY;
  if (cur === params.next) return true;
  // 无显式变更意图 → 保留旧策略
  if (!params.explicitChange) return true;
  return false;
}
