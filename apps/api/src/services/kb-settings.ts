import {
  DEFAULT_ALLOWED_MODES,
  DEFAULT_DEFAULT_MODE,
  type AskMode,
  type DataClass,
  type KbDocTypeCatalogItem,
  type KbSettings,
  type PatchKbSettingsBody,
  type QualitySnapshot,
  parseCrossDocDedupeAction,
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

/** 从 config_json 解析档位；缺省全量 + balanced */export function parseModesFromConfig(config: Record<string, unknown> | null | undefined): {
  allowedModes: AskMode[];
  defaultMode: AskMode;
} {
  const rawAllowed = config?.allowedModes;
  let allowedModes = DEFAULT_ALLOWED_MODES.slice() as AskMode[];
  if (Array.isArray(rawAllowed)) {
    const parsed = [...new Set(rawAllowed.filter(isAskMode))];
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

function parseDocTypeCodes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of raw) {
    if (typeof v !== 'string') continue;
    const code = v.trim();
    if (code.length === 0 || code.length > 64 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

function parseCatalogItem(raw: unknown, index: number): KbDocTypeCatalogItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.code !== 'string') return null;
  const code = row.code.trim();
  if (code.length === 0 || code.length > 64) return null;
  const labelRaw = typeof row.label === 'string' ? row.label.trim() : '';
  const label = (labelRaw.length > 0 ? labelRaw : code).slice(0, 128);
  const sort =
    typeof row.sort === 'number' && Number.isInteger(row.sort) && row.sort >= 0
      ? Math.min(row.sort, 999)
      : index;
  const enabled = row.enabled !== false;
  return { code, label, sort, enabled };
}

/** config_json.docTypeItems 为 SSOT；旧行只有 docTypes 则合成全启用。 */
export function parseDocTypeCatalogFromConfig(
  config: Record<string, unknown> | null | undefined,
): KbDocTypeCatalogItem[] {
  const rawItems = config?.docTypeItems;
  if (Array.isArray(rawItems)) {
    const out: KbDocTypeCatalogItem[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < rawItems.length && out.length < 32; i += 1) {
      const item = parseCatalogItem(rawItems[i], i);
      if (!item || seen.has(item.code)) continue;
      seen.add(item.code);
      out.push(item);
    }
    return out.slice().sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
  }
  const codes = parseDocTypeCodes(config?.docTypes);
  return codes.map((code, i) => ({ code, label: code, sort: i, enabled: true }));
}

/** 启用中的 doc_type 码；空 = ask scope 不限制 */
export function parseDocTypesFromConfig(
  config: Record<string, unknown> | null | undefined,
): string[] {
  return parseDocTypeCatalogFromConfig(config)
    .filter((item) => item.enabled)
    .map((item) => item.code);
}

export function catalogToEnabledCodes(items: readonly KbDocTypeCatalogItem[]): string[] {
  return items
    .slice()
    .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code))
    .filter((item) => item.enabled)
    .map((item) => item.code);
}

/** 旧简写 string[] → 全启用 catalog */
export function codesToCatalog(codes: readonly string[]): KbDocTypeCatalogItem[] {
  const seen = new Set<string>();
  const out: KbDocTypeCatalogItem[] = [];
  for (const raw of codes) {
    const code = raw.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, label: code, sort: out.length, enabled: true });
  }
  return out;
}

export function normalizeDocTypeCatalog(
  items: readonly KbDocTypeCatalogItem[],
): { ok: true; items: KbDocTypeCatalogItem[] } | { ok: false; message: string } {
  const seen = new Set<string>();
  const out: KbDocTypeCatalogItem[] = [];
  const ordered = items
    .slice()
    .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code));
  for (const item of ordered) {
    const code = item.code.trim();
    if (!code) continue;
    if (seen.has(code)) {
      return { ok: false, message: `duplicate docType code: ${code}` };
    }
    seen.add(code);
    const label = (item.label.trim() || code).slice(0, 128);
    out.push({
      code,
      label,
      sort: out.length,
      enabled: item.enabled,
    });
    if (out.length > 32) {
      return { ok: false, message: 'docTypeItems exceeds 32' };
    }
  }
  return { ok: true, items: out };
}

/** 成员 GET /doc-types：只回启用项；label 取 catalog */
export function toMemberDocTypeItems(
  config: Record<string, unknown> | null | undefined,
): { code: string; label: string }[] {
  return parseDocTypeCatalogFromConfig(config)
    .filter((item) => item.enabled)
    .map((item) => ({ code: item.code, label: item.label }));
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
 * 就绪 = 部门路径（enforce ∧ 非空 ownerDeptId）或名单路径（aclPrincipals 为数组，含 []）。
 * null / 缺字段不算名单就绪。吃解析后的 boolean。
 */
export function isSensitiveCompleteBlocked(params: {
  dataClass: DataClass;
  ownerDeptId: string | null | undefined;
  deptAclEnforce: boolean;
  aclPrincipals?: string[] | null;
}): boolean {
  if (params.dataClass !== 'sensitive') return false;
  const hasOwner =
    typeof params.ownerDeptId === 'string' && params.ownerDeptId.trim().length > 0;
  const deptReady = params.deptAclEnforce && hasOwner;
  const principalsReady = Array.isArray(params.aclPrincipals);
  return !deptReady && !principalsReady;
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
 * 文档标注 docType 须属于该 KB 已有枚举（空枚举则只能清成 null）。
 * 与 ask scope 不同：scope 在枚举为空时不限制。
 */
export function assertDocTypeAllowed(
  kbDocTypes: readonly string[],
  docType: string | null,
): { ok: true } | { ok: false; message: string } {
  if (docType == null) return { ok: true };
  if (kbDocTypes.includes(docType)) return { ok: true };
  return {
    ok: false,
    message: kbDocTypes.length
      ? `docType not in kb enum: ${docType}`
      : `docType not in kb enum: ${docType} (kb has no docTypes)`,
  };
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
  const catalog = parseDocTypeCatalogFromConfig(input.row.configJson ?? {});
  return {
    kbId: input.row.id,
    name: input.row.name,
    description: input.row.description,
    allowedModes,
    defaultMode,
    docTypes: catalogToEnabledCodes(catalog),
    docTypeItems: catalog,
    dataClass: parseDataClassFromConfig(input.row.configJson ?? {}),
    deptInheritDown: parseDeptInheritDownFromConfig(input.row.configJson ?? {}) ?? true,
    deptAclEnforce: parseDeptAclEnforceFromConfig(input.row.configJson ?? {}) ?? false,
    crossDocDedupeAction: parseCrossDocDedupeAction(input.row.configJson ?? {}),
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
  const prevCatalog = parseDocTypeCatalogFromConfig(row.configJson ?? {});
  const prevDocTypes = catalogToEnabledCodes(prevCatalog);
  const prevDataClass = parseDataClassFromConfig(row.configJson ?? {});
  const prevInherit = parseDeptInheritDownFromConfig(row.configJson ?? {});
  const prevEnforce = parseDeptAclEnforceFromConfig(row.configJson ?? {});
  const nextName = body.name !== undefined ? body.name : row.name;
  const nextDesc =
    body.description !== undefined ? body.description : (row.description ?? null);
  const nextAllowed = body.allowedModes ?? prev.allowedModes;
  const nextDefault = body.defaultMode ?? prev.defaultMode;
  const nextDataClass = body.dataClass !== undefined ? body.dataClass : prevDataClass;

  if (!nextAllowed.includes(nextDefault)) {
    return {
      ok: false,
      message: `defaultMode must be in allowedModes (got ${nextDefault})`,
    };
  }

  let nextCatalog = prevCatalog;
  if (body.docTypeItems !== undefined) {
    const normalized = normalizeDocTypeCatalog(body.docTypeItems);
    if (!normalized.ok) return { ok: false, message: normalized.message };
    nextCatalog = normalized.items;
  } else if (body.docTypes !== undefined) {
    nextCatalog = codesToCatalog(body.docTypes);
  }
  const nextDocTypes = catalogToEnabledCodes(nextCatalog);

  const nextConfig: Record<string, unknown> = {
    ...(row.configJson ?? {}),
    allowedModes: nextAllowed,
    defaultMode: nextDefault,
    docTypes: nextDocTypes,
    docTypeItems: nextCatalog,
    dataClass: nextDataClass,
  };
  if (body.deptInheritDown !== undefined) {
    nextConfig.deptInheritDown = body.deptInheritDown;
  }
  if (body.deptAclEnforce !== undefined) {
    nextConfig.deptAclEnforce = body.deptAclEnforce;
  }
  const prevDedupeAction = parseCrossDocDedupeAction(row.configJson ?? {});
  if (body.crossDocDedupeAction !== undefined) {
    nextConfig.crossDocDedupeAction = body.crossDocDedupeAction;
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
  if (JSON.stringify(nextCatalog) !== JSON.stringify(prevCatalog)) {
    diff.docTypeItems = { from: prevCatalog, to: nextCatalog };
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
  if (
    body.crossDocDedupeAction !== undefined &&
    body.crossDocDedupeAction !== prevDedupeAction
  ) {
    diff.crossDocDedupeAction = {
      from: prevDedupeAction,
      to: body.crossDocDedupeAction,
    };
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
