'use client';

/**
 * 库分片策略启用 / recommended。无 path。
 */

import type {
  ChunkStrategyCatalogItem,
  ChunkStrategyDocFamily,
  PatchKbChunkStrategiesBody,
} from '@strict-rag/contracts';
import { CHUNK_STRATEGY_DOC_FAMILIES } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { getKbChunkStrategies, patchKbChunkStrategies } from './api';

export type LoadChunkStrategiesResult =
  | { ok: true; items: ChunkStrategyCatalogItem[] }
  | { ok: false; message: string };

export async function loadKbChunkStrategies(kbId: string): Promise<LoadChunkStrategiesResult> {
  try {
    const data = await getKbChunkStrategies(kbId);
    return { ok: true, items: data.items };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function saveKbChunkStrategies(kbId: string, body: PatchKbChunkStrategiesBody) {
  try {
    const data = await patchKbChunkStrategies(kbId, body);
    return { ok: true as const, items: data.items };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

export function recommendedCodeByFamily(
  items: ChunkStrategyCatalogItem[],
): Record<ChunkStrategyDocFamily, string> {
  const out = {} as Record<ChunkStrategyDocFamily, string>;
  for (const family of CHUNK_STRATEGY_DOC_FAMILIES) {
    const hit = items.find((i) => i.enabled && i.recommendedFamilies.includes(family));
    out[family] = hit?.code ?? '';
  }
  return out;
}

export function toPatchItems(
  items: ChunkStrategyCatalogItem[],
  enabled: Record<string, boolean>,
  recommendedByFamily: Record<ChunkStrategyDocFamily, string>,
): PatchKbChunkStrategiesBody {
  return {
    items: items.map((i) => ({
      code: i.code,
      enabled: enabled[i.code] ?? i.enabled,
      recommendedFamilies: CHUNK_STRATEGY_DOC_FAMILIES.filter(
        (f) => recommendedByFamily[f] === i.code,
      ),
    })),
  };
}
