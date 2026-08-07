import {
  DEFAULT_ALLOWED_MODES,
  DEFAULT_DEFAULT_MODE,
  type AskMode,
  type KbSettings,
  type PatchKbSettingsBody,
  type QualitySnapshot,
} from '@strict-rag/contracts';
import { formatLocalDateTime, knowledgeBases } from '@strict-rag/db';
import { eq } from 'drizzle-orm';

import { getDb } from './db.js';

export type KbSettingsRow = {
  id: string;
  name: string;
  description: string | null;
  configJson: Record<string, unknown> | null;
};

export type KbSettingsRepo = {
  get(kbId: string): Promise<KbSettingsRow | null>;
  update(
    kbId: string,
    patch: {
      name?: string;
      description?: string | null;
      configJson?: Record<string, unknown>;
    },
  ): Promise<KbSettingsRow | null>;
};

function isAskMode(v: unknown): v is AskMode {
  return v === 'strict' || v === 'balanced' || v === 'fast';
}

/** 从 config_json 解析档位；缺省全量 + balanced */
export function parseModesFromConfig(config: Record<string, unknown> | null | undefined): {
  allowedModes: AskMode[];
  defaultMode: AskMode;
} {
  const rawAllowed = config?.allowedModes;
  let allowedModes = DEFAULT_ALLOWED_MODES.slice() as AskMode[];
  if (Array.isArray(rawAllowed)) {
    const parsed = rawAllowed.filter(isAskMode);
    if (parsed.length > 0) allowedModes = parsed;
  }
  const rawDefault = config?.defaultMode;
  let defaultMode: AskMode = DEFAULT_DEFAULT_MODE;
  if (isAskMode(rawDefault) && allowedModes.includes(rawDefault)) {
    defaultMode = rawDefault;
  } else if (!allowedModes.includes(defaultMode)) {
    defaultMode = allowedModes[0]!;
  }
  return { allowedModes, defaultMode };
}

export function buildKbSettingsView(input: {
  row: KbSettingsRow;
  quality: QualitySnapshot;
}): KbSettings {
  const { allowedModes, defaultMode } = parseModesFromConfig(input.row.configJson ?? {});
  return {
    kbId: input.row.id,
    name: input.row.name,
    description: input.row.description,
    allowedModes,
    defaultMode,
    qualitySnapshot: input.quality,
    sessionRewrite: { enabledDefault: false, locked: true },
  };
}

/**
 * 合并 PATCH 后校验 defaultMode ∈ allowedModes。
 * 返回 next 字段或 error message。
 */
export function mergeKbSettingsPatch(
  row: KbSettingsRow,
  body: PatchKbSettingsBody,
):
  | {
      ok: true;
      name: string;
      description: string | null;
      configJson: Record<string, unknown>;
      diff: Record<string, { from: unknown; to: unknown }>;
    }
  | { ok: false; message: string } {
  const prev = parseModesFromConfig(row.configJson ?? {});
  const nextName = body.name !== undefined ? body.name : row.name;
  const nextDesc =
    body.description !== undefined ? body.description : (row.description ?? null);
  const nextAllowed = body.allowedModes ?? prev.allowedModes;
  const nextDefault = body.defaultMode ?? prev.defaultMode;

  if (!nextAllowed.includes(nextDefault)) {
    return {
      ok: false,
      message: `defaultMode must be in allowedModes (got ${nextDefault})`,
    };
  }

  const nextConfig: Record<string, unknown> = {
    ...(row.configJson ?? {}),
    allowedModes: nextAllowed,
    defaultMode: nextDefault,
  };

  const diff: Record<string, { from: unknown; to: unknown }> = {};
  if (nextName !== row.name) diff.name = { from: row.name, to: nextName };
  if (nextDesc !== (row.description ?? null)) {
    diff.description = { from: row.description, to: nextDesc };
  }
  if (JSON.stringify(nextAllowed) !== JSON.stringify(prev.allowedModes)) {
    diff.allowedModes = { from: prev.allowedModes, to: nextAllowed };
  }
  if (nextDefault !== prev.defaultMode) {
    diff.defaultMode = { from: prev.defaultMode, to: nextDefault };
  }

  return {
    ok: true,
    name: nextName,
    description: nextDesc,
    configJson: nextConfig,
    diff,
  };
}

export const kbSettingsRepo: KbSettingsRepo = {
  async get(kbId) {
    const [row] = await getDb()
      .select({
        id: knowledgeBases.id,
        name: knowledgeBases.name,
        description: knowledgeBases.description,
        configJson: knowledgeBases.configJson,
      })
      .from(knowledgeBases)
      .where(eq(knowledgeBases.id, kbId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? null,
      configJson: (row.configJson as Record<string, unknown> | null) ?? {},
    };
  },

  async update(kbId, patch) {
    const set: {
      name?: string;
      description?: string | null;
      configJson?: Record<string, unknown>;
      updatedAt: string;
    } = { updatedAt: formatLocalDateTime() };
    if (patch.name !== undefined) set.name = patch.name;
    if (patch.description !== undefined) set.description = patch.description;
    if (patch.configJson !== undefined) set.configJson = patch.configJson;

    await getDb().update(knowledgeBases).set(set).where(eq(knowledgeBases.id, kbId));
    return kbSettingsRepo.get(kbId);
  },
};

/** 内存 repo：单测注入，不碰 PG */
export function createMemoryKbSettingsRepo(seed: KbSettingsRow[]): KbSettingsRepo {
  const map = new Map<string, KbSettingsRow>(
    seed.map((r) => [r.id, { ...r, configJson: { ...(r.configJson ?? {}) } }]),
  );
  return {
    async get(kbId) {
      const row = map.get(kbId);
      return row
        ? { ...row, configJson: { ...(row.configJson ?? {}) } }
        : null;
    },
    async update(kbId, patch) {
      const cur = map.get(kbId);
      if (!cur) return null;
      const next: KbSettingsRow = {
        ...cur,
        name: patch.name !== undefined ? patch.name : cur.name,
        description: patch.description !== undefined ? patch.description : cur.description,
        configJson:
          patch.configJson !== undefined
            ? { ...patch.configJson }
            : { ...(cur.configJson ?? {}) },
      };
      map.set(kbId, next);
      return { ...next, configJson: { ...(next.configJson ?? {}) } };
    },
  };
}
