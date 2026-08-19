import {
  DEFAULT_ALLOWED_MODES,
  DEFAULT_DEFAULT_MODE,
  type AskMode,
  type DataClass,
  type KbSettings,
  type PatchKbSettingsBody,
  type QualitySnapshot,
} from '@strict-rag/contracts';
import { formatLocalDateTime, knowledgeBases } from '@strict-rag/db';
import { eq } from 'drizzle-orm';

import { getDb } from './db.js';
import { isDeptAclEnforced, isDeptInheritDown } from './retrieve/dept-acl.js';

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

/** config_json.docTypes；空/缺省 = 无限制 */
export function parseDocTypesFromConfig(
  config: Record<string, unknown> | null | undefined,
): string[] {
  const raw = config?.docTypes;
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && v.length > 0 && v.length <= 64) out.push(v);
  }
  return out;
}

/** config_json.dataClass；只认 sensitive，其余/缺省 → internal */
export function parseDataClassFromConfig(
  config: Record<string, unknown> | null | undefined,
): DataClass {
  return config?.dataClass === 'sensitive' ? 'sensitive' : 'internal';
}

/** config_json.deptInheritDown；仅字面 true/false，其余/缺省 → undefined（跟 env） */
export function parseDeptInheritDownFromConfig(
  config: Record<string, unknown> | null | undefined,
): boolean | undefined {
  if (config?.deptInheritDown === true) return true;
  if (config?.deptInheritDown === false) return false;
  return undefined;
}

/** KB 显式值覆盖 env；未写跟 DEPT_INHERIT_DOWN（缺省 true） */
export function resolveDeptInheritDown(kbValue: boolean | undefined): boolean {
  return kbValue ?? isDeptInheritDown();
}

/** config_json.deptAclEnforce；仅字面 true/false，其余/缺省 → undefined（跟 env） */
export function parseDeptAclEnforceFromConfig(
  config: Record<string, unknown> | null | undefined,
): boolean | undefined {
  if (config?.deptAclEnforce === true) return true;
  if (config?.deptAclEnforce === false) return false;
  return undefined;
}

/** KB 显式值覆盖 env；未写跟 DEPT_ACL_ENFORCE（缺省 false） */
export function resolveDeptAclEnforce(kbValue: boolean | undefined): boolean {
  return kbValue ?? isDeptAclEnforced();
}

/**
 * P3b-SENS：sensitive 且 ACL 未就绪则挡 complete。
 * 未就绪 = enforce 关或 ownerDeptId 空。吃解析后的 boolean。
 */
export function isSensitiveCompleteBlocked(params: {
  dataClass: DataClass;
  ownerDeptId: string | null | undefined;
  deptAclEnforce: boolean;
}): boolean {
  if (params.dataClass !== 'sensitive') return false;
  const hasOwner =
    typeof params.ownerDeptId === 'string' && params.ownerDeptId.trim().length > 0;
  return !params.deptAclEnforce || !hasOwner;
}

/**
 * B2-W：ask 入口档位闸。
 * 请求未带 mode → defaultMode；带了必须 ∈ allowedModes。
 */
export function resolveAskMode(params: {
  requested?: AskMode;
  allowedModes: readonly AskMode[];
  defaultMode: AskMode;
}): { ok: true; mode: AskMode } | { ok: false; message: string } {
  const mode = params.requested ?? params.defaultMode;
  if (!params.allowedModes.includes(mode)) {
    return {
      ok: false,
      message: `mode not allowed: ${mode} (allowed: ${params.allowedModes.join(',')})`,
    };
  }
  return { ok: true, mode };
}

/**
 * B2-W：scope.docTypes 须 ⊆ KB 允许列表（KB 列表为空 = 不限制）。
 */
export function assertScopeDocTypesAllowed(params: {
  scopeDocTypes?: readonly string[];
  kbDocTypes: readonly string[];
}): { ok: true } | { ok: false; message: string; invalid: string[] } {
  if (!params.kbDocTypes.length || !params.scopeDocTypes?.length) {
    return { ok: true };
  }
  const allowed = new Set(params.kbDocTypes);
  const invalid = params.scopeDocTypes.filter((t) => !allowed.has(t));
  if (invalid.length === 0) return { ok: true };
  return {
    ok: false,
    message: `scope.docTypes not allowed: ${invalid.join(',')}`,
    invalid,
  };
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
    docTypes: parseDocTypesFromConfig(input.row.configJson ?? {}),
    dataClass: parseDataClassFromConfig(input.row.configJson ?? {}),
    deptInheritDown: parseDeptInheritDownFromConfig(input.row.configJson ?? {}) ?? true,
    deptAclEnforce: parseDeptAclEnforceFromConfig(input.row.configJson ?? {}) ?? false,
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
  const prevDocTypes = parseDocTypesFromConfig(row.configJson ?? {});
  const prevDataClass = parseDataClassFromConfig(row.configJson ?? {});
  const prevInherit = parseDeptInheritDownFromConfig(row.configJson ?? {});
  const prevEnforce = parseDeptAclEnforceFromConfig(row.configJson ?? {});
  const nextName = body.name !== undefined ? body.name : row.name;
  const nextDesc =
    body.description !== undefined ? body.description : (row.description ?? null);
  const nextAllowed = body.allowedModes ?? prev.allowedModes;
  const nextDefault = body.defaultMode ?? prev.defaultMode;
  const nextDocTypes = body.docTypes !== undefined ? body.docTypes : prevDocTypes;
  const nextDataClass = body.dataClass !== undefined ? body.dataClass : prevDataClass;

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
    docTypes: nextDocTypes,
    dataClass: nextDataClass,
  };
  if (body.deptInheritDown !== undefined) {
    nextConfig.deptInheritDown = body.deptInheritDown;
  }
  if (body.deptAclEnforce !== undefined) {
    nextConfig.deptAclEnforce = body.deptAclEnforce;
  }

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
  if (JSON.stringify(nextDocTypes) !== JSON.stringify(prevDocTypes)) {
    diff.docTypes = { from: prevDocTypes, to: nextDocTypes };
  }
  if (nextDataClass !== prevDataClass) {
    diff.dataClass = { from: prevDataClass, to: nextDataClass };
  }
  if (body.deptInheritDown !== undefined && body.deptInheritDown !== prevInherit) {
    diff.deptInheritDown = { from: prevInherit, to: body.deptInheritDown };
  }
  if (body.deptAclEnforce !== undefined && body.deptAclEnforce !== prevEnforce) {
    diff.deptAclEnforce = { from: prevEnforce, to: body.deptAclEnforce };
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
