/**
 * B12 / ADR-053：分片策略注册表。
 * 上传/reindex 仅允许 **worker 已实现** 的策略码；旧文档不因注册表变更自动切换。
 * 实现集合 SSOT：`@strict-rag/contracts` · `IMPLEMENTED_CHUNK_STRATEGIES`。
 */

import {
  DEFAULT_CHUNK_STRATEGY,
  IMPLEMENTED_CHUNK_STRATEGIES,
  isImplementedChunkStrategy,
  KNOWN_CHUNK_STRATEGY_CODES,
} from '@strict-rag/contracts';

export type ChunkStrategyDef = {
  code: string;
  name: string;
  /** 是否系统种子（不可从注册表删除） */
  system: boolean;
  /**
   * worker 是否已实现执行。
   * false = roadmap 条目：可列在 catalog，**禁止**写入 documents / 入队 chunk。
   */
  implemented: boolean;
};

const NAMES: Record<string, string> = {
  structure_paragraph: '结构段落',
  fixed_window: '固定窗口',
  heading_sections: '标题分节',
};

/** 进程内 catalog（含 roadmap）；写入闸见 isWritable / resolve* */
const REGISTRY = new Map<string, ChunkStrategyDef>(
  KNOWN_CHUNK_STRATEGY_CODES.map((code) => [
    code,
    {
      code,
      name: NAMES[code] ?? code,
      system: true,
      implemented: isImplementedChunkStrategy(code),
    },
  ]),
);

export { DEFAULT_CHUNK_STRATEGY, isImplementedChunkStrategy };

export function listChunkStrategies(): ChunkStrategyDef[] {
  return [...REGISTRY.values()];
}

/** 可写入 / 可入队执行的策略（= implemented） */
export function listWritableChunkStrategies(): ChunkStrategyDef[] {
  return listChunkStrategies().filter((s) => s.implemented);
}

export function isRegisteredChunkStrategy(code: string): boolean {
  return REGISTRY.has(code);
}

export function isWritableChunkStrategy(code: string): boolean {
  return isImplementedChunkStrategy(code);
}

function implementedListMessage(): string {
  return IMPLEMENTED_CHUNK_STRATEGIES.join(',');
}

function rejectNotImplemented(code: string): { ok: false; message: string } {
  return {
    ok: false,
    message: `chunkStrategy not implemented by worker: ${code} (implemented: ${implementedListMessage()})`,
  };
}

/**
 * 解析必选策略：
 * - 传入 code → 必须已注册且 **已实现**
 * - 未传 → 默认 structure_paragraph
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
  if (!isWritableChunkStrategy(code)) {
    return rejectNotImplemented(code);
  }
  return { ok: true, code };
}

/**
 * 旧文档不自动切：仅当 explicit 新策略且与当前不同才返回 false（应覆盖）。
 */
export function shouldRetainExistingStrategy(params: {
  existing: string | null | undefined;
  next: string;
  explicitChange: boolean;
}): boolean {
  const cur = params.existing ?? DEFAULT_CHUNK_STRATEGY;
  if (cur === params.next) return true;
  if (!params.explicitChange) return true;
  return false;
}

/**
 * complete / reindex 共用：解析最终写入策略。
 * - 最终 code **必须** implemented（含保留旧值路径）
 * - 多策略 catalog（length>1）且 requireExplicit：必须显式传 body
 */
export function resolveDocumentChunkStrategy(params: {
  existing: string | null | undefined;
  requested: string | null | undefined;
  /** reindex / complete 多策略时强制 body 必带 */
  requireExplicit?: boolean;
}):
  | { ok: true; code: string; retained: boolean; changed: boolean }
  | { ok: false; message: string } {
  const explicit = Boolean(params.requested?.trim());
  if (params.requireExplicit && !explicit) {
    const writable = listWritableChunkStrategies()
      .map((s) => s.code)
      .join(',');
    return {
      ok: false,
      message: `chunkStrategy is required (implemented: ${writable || implementedListMessage()})`,
    };
  }

  const requestedGate = resolveRequiredChunkStrategy(params.requested);
  if (!requestedGate.ok) return requestedGate;

  const retain = shouldRetainExistingStrategy({
    existing: params.existing,
    next: requestedGate.code,
    explicitChange: explicit,
  });

  const code =
    retain && params.existing?.trim()
      ? params.existing.trim()
      : retain
        ? (params.existing ?? requestedGate.code)
        : requestedGate.code;

  if (!isRegisteredChunkStrategy(code)) {
    return {
      ok: false,
      message: `existing chunkStrategy not registered: ${code}`,
    };
  }
  // 保留路径也不得写入未实现码（防假策略入库）
  if (!isWritableChunkStrategy(code)) {
    return rejectNotImplemented(code);
  }

  const prev = params.existing ?? DEFAULT_CHUNK_STRATEGY;
  return {
    ok: true,
    code,
    retained: retain,
    changed: prev !== code,
  };
}

/**
 * 是否「多策略闸」：catalog 中有 >1 个已知码时 reindex 须显式传
 *（即使仅 1 个已实现，也避免运营以为可选假策略）。
 * 写入许可仍只看 implemented。
 */
export function isMultiStrategyCatalog(): boolean {
  return listChunkStrategies().length > 1;
}
