/**
 * ADR-053 三层：平台定义表 + 库启用表。
 * 写入闸仍对齐 contracts IMPLEMENTED_*；表空时按种子/已实现码回落，不挡 complete。
 */

import {
  CHUNK_STRATEGY_PLATFORM_SEED,
  DEFAULT_CHUNK_STRATEGY_PARAMS,
  IMPLEMENTED_CHUNK_STRATEGIES,
  docFamilyFromContentType,
  isImplementedChunkStrategy,
  type ForUploadResponse,
  type ChunkStrategyCatalogItem,
  type ChunkStrategyDocFamily,
  type PatchKbChunkStrategiesBody,
} from '@strict-rag/contracts';
import { chunkStrategyDefinitions, kbChunkStrategies } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

export type ChunkStrategyDefinitionRow = {
  code: string;
  name: string;
  docFamilies: string[];
  paramSchema: Record<string, unknown>;
  pipelineId: string;
  implemented: boolean;
  system: boolean;
};

export type KbChunkStrategyRow = {
  kbId: string;
  code: string;
  enabled: boolean;
  paramOverrides: Record<string, unknown> | null;
  recommendedFamilies: string[];
};

export type ChunkStrategyCatalogRepo = {
  listDefinitions(): Promise<ChunkStrategyDefinitionRow[]>;
  listKbStrategies(kbId: string): Promise<KbChunkStrategyRow[]>;
  replaceKbStrategies(kbId: string, rows: KbChunkStrategyRow[]): Promise<void>;
};

function seedDefinitions(): ChunkStrategyDefinitionRow[] {
  return CHUNK_STRATEGY_PLATFORM_SEED.map((s) => ({
    code: s.code,
    name: s.name,
    docFamilies: [...s.docFamilies],
    paramSchema: { ...s.paramSchema },
    pipelineId: s.pipelineId,
    implemented: isImplementedChunkStrategy(s.code),
    system: s.system,
  }));
}

export function defaultKbStrategyRows(kbId: string): KbChunkStrategyRow[] {
  return seedDefinitions()
    .filter((d) => isImplementedChunkStrategy(d.code))
    .map((d) => ({
      kbId,
      code: d.code,
      enabled: true,
      paramOverrides: null,
      recommendedFamilies: [...d.docFamilies],
    }));
}

export const dbChunkStrategyCatalogRepo: ChunkStrategyCatalogRepo = {
  async listDefinitions() {
    try {
      const rows = await getDb().select().from(chunkStrategyDefinitions);
      if (rows.length > 0) {
        return rows.map((r) => ({
          code: r.code,
          name: r.name,
          docFamilies: r.docFamilies ?? [],
          paramSchema: r.paramSchema ?? { ...DEFAULT_CHUNK_STRATEGY_PARAMS },
          pipelineId: r.pipelineId,
          implemented: r.implemented,
          system: r.system,
        }));
      }
    } catch {
      /* 表未迁：回落种子 */
    }
    return seedDefinitions();
  },

  async listKbStrategies(kbId: string) {
    try {
      const rows = await getDb()
        .select()
        .from(kbChunkStrategies)
        .where(eq(kbChunkStrategies.kbId, kbId));
      return rows.map((r) => ({
        kbId: r.kbId,
        code: r.code,
        enabled: r.enabled,
        paramOverrides: r.paramOverrides ?? null,
        recommendedFamilies: r.recommendedFamilies ?? [],
      }));
    } catch {
      return [];
    }
  },

  async replaceKbStrategies(kbId: string, rows: KbChunkStrategyRow[]) {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.delete(kbChunkStrategies).where(eq(kbChunkStrategies.kbId, kbId));
      if (rows.length === 0) return;
      await tx.insert(kbChunkStrategies).values(
        rows.map((r) => ({
          id: uuidv7(),
          kbId,
          code: r.code,
          enabled: r.enabled,
          paramOverrides: r.paramOverrides,
          recommendedFamilies: r.recommendedFamilies,
        })),
      );
    });
  },
};

let catalogRepoOverride: ChunkStrategyCatalogRepo | null = null;
let vitestDefaultRepo: ChunkStrategyCatalogRepo | null = null;

function activeCatalogRepo(): ChunkStrategyCatalogRepo {
  if (catalogRepoOverride) return catalogRepoOverride;
  if (process.env.VITEST) {
    vitestDefaultRepo ??= createMemoryChunkStrategyCatalogRepo();
    return vitestDefaultRepo;
  }
  return dbChunkStrategyCatalogRepo;
}

export function setChunkStrategyCatalogRepoForTest(repo: ChunkStrategyCatalogRepo | null) {
  catalogRepoOverride = repo;
}

export function getChunkStrategyCatalogRepo(): ChunkStrategyCatalogRepo {
  return activeCatalogRepo();
}

export function createMemoryChunkStrategyCatalogRepo(init?: {
  kbId: string;
  enabled: Array<{
    code: string;
    enabled?: boolean;
    recommendedFamilies?: string[];
    paramOverrides?: Record<string, unknown> | null;
  }>;
}): ChunkStrategyCatalogRepo {
  const defs = seedDefinitions();
  const kbMap = new Map<string, KbChunkStrategyRow[]>();
  if (init) {
    kbMap.set(
      init.kbId,
      init.enabled.map((e) => ({
        kbId: init.kbId,
        code: e.code,
        enabled: e.enabled ?? true,
        paramOverrides: e.paramOverrides ?? null,
        recommendedFamilies: e.recommendedFamilies ?? [],
      })),
    );
  }
  return {
    async listDefinitions() {
      return defs;
    },
    async listKbStrategies(kbId: string) {
      return kbMap.get(kbId) ?? [];
    },
    async replaceKbStrategies(kbId: string, rows: KbChunkStrategyRow[]) {
      kbMap.set(kbId, rows);
    },
  };
}

export function snapshotChunkStrategyParams(
  def: ChunkStrategyDefinitionRow | undefined,
  overrides: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  return {
    ...(def?.paramSchema ?? { ...DEFAULT_CHUNK_STRATEGY_PARAMS }),
    ...(overrides ?? {}),
  };
}

export async function buildChunkStrategyCatalog(kbId: string): Promise<ChunkStrategyCatalogItem[]> {
  const defs = await activeCatalogRepo().listDefinitions();
  const kbRows = await activeCatalogRepo().listKbStrategies(kbId);
  const byCode = new Map(kbRows.map((r) => [r.code, r]));
  const fallback = kbRows.length === 0;
  const fallbackEnabled = new Set<string>(IMPLEMENTED_CHUNK_STRATEGIES);
  return defs.map((d) => {
    const row = byCode.get(d.code);
    const enabled = row ? row.enabled : fallback && fallbackEnabled.has(d.code);
    return {
      code: d.code,
      name: d.name,
      implemented: isImplementedChunkStrategy(d.code),
      system: d.system,
      docFamilies: d.docFamilies.filter((f): f is ChunkStrategyDocFamily =>
        ['md', 'txt', 'docx', 'pdf_text'].includes(f),
      ),
      paramSchema: d.paramSchema,
      pipelineId: d.pipelineId,
      enabled,
      recommendedFamilies: (row?.recommendedFamilies ?? (enabled ? d.docFamilies : [])).filter(
        (f): f is ChunkStrategyDocFamily => ['md', 'txt', 'docx', 'pdf_text'].includes(f),
      ),
      paramOverrides: row?.paramOverrides ?? null,
    };
  });
}

export async function getForUpload(kbId: string, contentType: string): Promise<ForUploadResponse> {
  const family = docFamilyFromContentType(contentType);
  const catalog = await buildChunkStrategyCatalog(kbId);
  const available = catalog
    .filter((i) => i.enabled && i.docFamilies.includes(family) && isImplementedChunkStrategy(i.code))
    .map((i) => ({
      code: i.code,
      name: i.name,
      implemented: true,
      recommended: i.recommendedFamilies.includes(family),
    }));
  const recommendedCode = available.find((a) => a.recommended)?.code ?? available[0]?.code ?? null;
  const requireExplicit = available.length >= 2;
  const autoCode = available.length === 1 ? available[0]!.code : null;
  return {
    contentType,
    family,
    available,
    recommendedCode,
    requireExplicit,
    autoCode,
  };
}

export async function applyKbChunkStrategyPatch(
  kbId: string,
  body: PatchKbChunkStrategiesBody,
): Promise<{ ok: true; items: ChunkStrategyCatalogItem[] } | { ok: false; message: string }> {
  const defs = await activeCatalogRepo().listDefinitions();
  const known = new Set(defs.map((d) => d.code));
  for (const item of body.items) {
    if (!known.has(item.code)) {
      return { ok: false, message: `unknown chunkStrategy: ${item.code}` };
    }
  }
  const existing = await activeCatalogRepo().listKbStrategies(kbId);
  const nextByCode = new Map(existing.map((r) => [r.code, { ...r }]));
  if (existing.length === 0) {
    for (const row of defaultKbStrategyRows(kbId)) {
      nextByCode.set(row.code, row);
    }
  }
  for (const item of body.items) {
    const prev = nextByCode.get(item.code);
    nextByCode.set(item.code, {
      kbId,
      code: item.code,
      enabled: item.enabled,
      paramOverrides:
        item.paramOverrides !== undefined ? item.paramOverrides : (prev?.paramOverrides ?? null),
      recommendedFamilies:
        item.recommendedFamilies !== undefined
          ? [...item.recommendedFamilies]
          : (prev?.recommendedFamilies ?? []),
    });
  }
  await activeCatalogRepo().replaceKbStrategies(kbId, [...nextByCode.values()]);
  return { ok: true, items: await buildChunkStrategyCatalog(kbId) };
}

export async function paramsSnapshotFor(kbId: string, code: string): Promise<Record<string, unknown>> {
  const defs = await activeCatalogRepo().listDefinitions();
  const kbRows = await activeCatalogRepo().listKbStrategies(kbId);
  const def = defs.find((d) => d.code === code);
  const row = kbRows.find((r) => r.code === code);
  return snapshotChunkStrategyParams(def, row?.paramOverrides);
}
