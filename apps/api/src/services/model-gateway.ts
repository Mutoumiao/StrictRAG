import {
  formatModelRef,
  parseModelRef,
  requiredModelTypeForPurpose,
  type BindingPurpose,
  type CreateModelProviderBody,
  type ModelCatalogItem,
  type ModelItem,
  type ModelProvider,
  type ModelType,
  type PatchModelProviderBody,
  type PlatformBindings,
  type PurposeBinding,
  type PutPlatformBindingsBody,
} from '@strict-rag/contracts';
import {
  formatLocalDateTime,
  modelBindings,
  modelProviders,
  type ModelProviderModelRow,
} from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';
import { DEV_DEFAULT_TENANT } from './members.js';

export type ProviderRow = {
  id: string;
  tenantId: string;
  name: string;
  presetKey: string;
  baseUrl: string;
  apiKeyEnc: string | null;
  timeoutMs: number;
  enabled: number;
  notes: string | null;
  modelsJson: ModelProviderModelRow[];
  createdAt: string | null;
  updatedAt: string | null;
};

export type BindingRow = {
  id: string;
  tenantId: string;
  scope: string;
  scopeId: string;
  purpose: string;
  primaryRef: string;
  fallbackRefs: string[];
};

export type ModelGatewayRepo = {
  listProviders(tenantId: string): Promise<ProviderRow[]>;
  getProvider(tenantId: string, id: string): Promise<ProviderRow | null>;
  createProvider(
    tenantId: string,
    input: {
      name: string;
      presetKey: string;
      baseUrl: string;
      apiKeyEnc: string | null;
      timeoutMs: number;
      enabled: number;
      notes: string | null;
      modelsJson: ModelProviderModelRow[];
      createdBy?: string;
    },
  ): Promise<ProviderRow>;
  updateProvider(
    tenantId: string,
    id: string,
    patch: Partial<{
      name: string;
      presetKey: string;
      baseUrl: string;
      apiKeyEnc: string | null;
      timeoutMs: number;
      enabled: number;
      notes: string | null;
      modelsJson: ModelProviderModelRow[];
      updatedBy: string;
    }>,
  ): Promise<ProviderRow | null>;
  deleteProvider(tenantId: string, id: string): Promise<boolean>;
  listPlatformBindings(tenantId: string): Promise<BindingRow[]>;
  replacePlatformBindings(
    tenantId: string,
    rows: Array<{ purpose: string; primaryRef: string; fallbackRefs: string[] }>,
    updatedBy?: string,
  ): Promise<BindingRow[]>;
};

function toModels(items: ModelItem[]): ModelProviderModelRow[] {
  return items.map((m) => ({
    name: m.name,
    type: m.type,
    enabled: m.enabled ?? true,
    ...(m.dimensions !== undefined ? { dimensions: m.dimensions } : {}),
  }));
}

export function toPublicProvider(row: ProviderRow): ModelProvider {
  return {
    id: row.id,
    name: row.name,
    presetKey: row.presetKey as ModelProvider['presetKey'],
    baseUrl: row.baseUrl,
    timeoutMs: row.timeoutMs,
    enabled: row.enabled === 1,
    notes: row.notes,
    models: (row.modelsJson ?? []).map((m) => ({
      name: m.name,
      type: m.type,
      enabled: m.enabled,
      ...(m.dimensions !== undefined ? { dimensions: m.dimensions } : {}),
    })),
    hasApiKey: Boolean(row.apiKeyEnc && row.apiKeyEnc.length > 0),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function buildCatalog(providers: ProviderRow[]): ModelCatalogItem[] {
  const out: ModelCatalogItem[] = [];
  for (const p of providers) {
    if (p.enabled !== 1) continue;
    for (const m of p.modelsJson ?? []) {
      if (!m.enabled) continue;
      out.push({
        ref: formatModelRef(p.id, m.name),
        providerId: p.id,
        providerName: p.name,
        modelName: m.name,
        type: m.type,
      });
    }
  }
  return out;
}

export function bindingsToMap(rows: BindingRow[]): PlatformBindings {
  const map: PlatformBindings = {};
  for (const r of rows) {
    map[r.purpose as BindingPurpose] = {
      primary: r.primaryRef,
      ...(r.fallbackRefs?.length ? { fallbacks: r.fallbackRefs } : {}),
    };
  }
  return map;
}

function findModel(
  providers: ProviderRow[],
  ref: string,
): { provider: ProviderRow; model: ModelProviderModelRow } | null {
  const parsed = parseModelRef(ref);
  if (!parsed) return null;
  const provider = providers.find((p) => p.id === parsed.providerId);
  if (!provider) return null;
  const model = (provider.modelsJson ?? []).find((m) => m.name === parsed.modelName);
  if (!model) return null;
  return { provider, model };
}

/**
 * 校验平台绑定：ref 存在/启用、类型匹配、judge≠judge_aux。
 */
export function validatePlatformBindings(
  providers: ProviderRow[],
  bindings: Record<string, PurposeBinding>,
): { ok: true } | { ok: false; message: string } {
  const resolved: Partial<Record<BindingPurpose, string>> = {};

  for (const [purpose, binding] of Object.entries(bindings)) {
    const p = purpose as BindingPurpose;
    const need = requiredModelTypeForPurpose(p);
    const refs = [binding.primary, ...(binding.fallbacks ?? [])];
    for (const ref of refs) {
      const hit = findModel(providers, ref);
      if (!hit) {
        return { ok: false, message: `unknown or missing model ref: ${ref}` };
      }
      if (hit.provider.enabled !== 1 || !hit.model.enabled) {
        return { ok: false, message: `model ref disabled: ${ref}` };
      }
      if (hit.model.type !== need) {
        return {
          ok: false,
          message: `purpose ${p} requires type ${need}, got ${hit.model.type} (${ref})`,
        };
      }
    }
    resolved[p] = binding.primary;
  }

  const j = resolved.judge;
  const ja = resolved.judge_aux;
  if (j && ja && j === ja) {
    return {
      ok: false,
      message: 'judge and judge_aux must resolve to different provider#model (ADR-042)',
    };
  }

  return { ok: true };
}

/** 是否有平台绑定引用该 providerId */
export function providerReferencedByBindings(
  rows: BindingRow[],
  providerId: string,
): boolean {
  const prefix = `${providerId}#`;
  for (const r of rows) {
    if (r.primaryRef.startsWith(prefix)) return true;
    if ((r.fallbackRefs ?? []).some((f) => f.startsWith(prefix))) return true;
  }
  return false;
}

export function applyCreateBody(
  tenantId: string,
  body: CreateModelProviderBody,
  createdBy?: string,
): Parameters<ModelGatewayRepo['createProvider']>[1] {
  return {
    name: body.name,
    presetKey: body.presetKey,
    baseUrl: body.baseUrl.replace(/\/$/, ''),
    apiKeyEnc: body.apiKey ?? null,
    timeoutMs: body.timeoutMs ?? 60_000,
    enabled: body.enabled === false ? 0 : 1,
    notes: body.notes ?? null,
    modelsJson: toModels(body.models),
    createdBy,
  };
}

export function applyPatchBody(
  row: ProviderRow,
  body: PatchModelProviderBody,
):
  | { ok: true; patch: Parameters<ModelGatewayRepo['updateProvider']>[2] }
  | { ok: false; message: string } {
  const patch: Parameters<ModelGatewayRepo['updateProvider']>[2] = {};
  if (body.name !== undefined) patch.name = body.name;
  if (body.presetKey !== undefined) patch.presetKey = body.presetKey;
  if (body.baseUrl !== undefined) patch.baseUrl = body.baseUrl.replace(/\/$/, '');
  if (body.timeoutMs !== undefined) patch.timeoutMs = body.timeoutMs;
  if (body.enabled !== undefined) patch.enabled = body.enabled ? 1 : 0;
  if (body.notes !== undefined) patch.notes = body.notes;
  if (body.models !== undefined) patch.modelsJson = toModels(body.models);
  if (body.apiKey !== undefined) {
    // null → 清空；string → 更新；不传则保留
    patch.apiKeyEnc = body.apiKey;
  }
  if (Object.keys(patch).length === 0) {
    return { ok: false, message: 'no changes' };
  }
  return { ok: true, patch };
}

// ─── memory repo（单测） ───────────────────────────────────────────

export function createMemoryModelGatewayRepo(
  seed: { providers?: ProviderRow[]; bindings?: BindingRow[] } = {},
): ModelGatewayRepo {
  const providers = new Map<string, ProviderRow>(
    (seed.providers ?? []).map((p) => [p.id, { ...p, modelsJson: [...(p.modelsJson ?? [])] }]),
  );
  let bindings = (seed.bindings ?? []).map((b) => ({ ...b, fallbackRefs: [...(b.fallbackRefs ?? [])] }));

  return {
    async listProviders(tenantId) {
      return [...providers.values()].filter((p) => p.tenantId === tenantId);
    },
    async getProvider(tenantId, id) {
      const p = providers.get(id);
      if (!p || p.tenantId !== tenantId) return null;
      return { ...p, modelsJson: [...p.modelsJson] };
    },
    async createProvider(tenantId, input) {
      const id = uuidv7();
      const now = formatLocalDateTime();
      const row: ProviderRow = {
        id,
        tenantId,
        name: input.name,
        presetKey: input.presetKey,
        baseUrl: input.baseUrl,
        apiKeyEnc: input.apiKeyEnc,
        timeoutMs: input.timeoutMs,
        enabled: input.enabled,
        notes: input.notes,
        modelsJson: input.modelsJson,
        createdAt: now,
        updatedAt: now,
      };
      providers.set(id, row);
      return { ...row, modelsJson: [...row.modelsJson] };
    },
    async updateProvider(tenantId, id, patch) {
      const cur = providers.get(id);
      if (!cur || cur.tenantId !== tenantId) return null;
      const next: ProviderRow = {
        ...cur,
        ...patch,
        modelsJson: patch.modelsJson ?? cur.modelsJson,
        updatedAt: formatLocalDateTime(),
      };
      providers.set(id, next);
      return { ...next, modelsJson: [...next.modelsJson] };
    },
    async deleteProvider(tenantId, id) {
      const cur = providers.get(id);
      if (!cur || cur.tenantId !== tenantId) return false;
      providers.delete(id);
      return true;
    },
    async listPlatformBindings(tenantId) {
      return bindings
        .filter((b) => b.tenantId === tenantId && b.scope === 'platform')
        .map((b) => ({ ...b, fallbackRefs: [...b.fallbackRefs] }));
    },
    async replacePlatformBindings(tenantId, rows, updatedBy) {
      bindings = bindings.filter((b) => !(b.tenantId === tenantId && b.scope === 'platform'));
      const now = formatLocalDateTime();
      const created: BindingRow[] = rows.map((r) => ({
        id: uuidv7(),
        tenantId,
        scope: 'platform',
        scopeId: '',
        purpose: r.purpose,
        primaryRef: r.primaryRef,
        fallbackRefs: r.fallbackRefs,
      }));
      for (const c of created) {
        bindings.push({
          ...c,
          // keep meta light in memory
        });
      }
      void updatedBy;
      void now;
      return created.map((b) => ({ ...b, fallbackRefs: [...b.fallbackRefs] }));
    },
  };
}

// ─── PG repo ───────────────────────────────────────────────────────

function mapProvider(r: typeof modelProviders.$inferSelect): ProviderRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    name: r.name,
    presetKey: r.presetKey,
    baseUrl: r.baseUrl,
    apiKeyEnc: r.apiKeyEnc,
    timeoutMs: r.timeoutMs,
    enabled: r.enabled,
    notes: r.notes,
    modelsJson: (r.modelsJson ?? []) as ModelProviderModelRow[],
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
  };
}

function mapBinding(r: typeof modelBindings.$inferSelect): BindingRow {
  return {
    id: r.id,
    tenantId: r.tenantId,
    scope: r.scope,
    scopeId: r.scopeId,
    purpose: r.purpose,
    primaryRef: r.primaryRef,
    fallbackRefs: (r.fallbackRefs ?? []) as string[],
  };
}

export const modelGatewayRepo: ModelGatewayRepo = {
  async listProviders(tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(modelProviders)
      .where(eq(modelProviders.tenantId, tenantId));
    return rows.map(mapProvider);
  },
  async getProvider(tenantId, id) {
    const db = getDb();
    const [row] = await db
      .select()
      .from(modelProviders)
      .where(and(eq(modelProviders.tenantId, tenantId), eq(modelProviders.id, id)))
      .limit(1);
    return row ? mapProvider(row) : null;
  },
  async createProvider(tenantId, input) {
    const db = getDb();
    const id = uuidv7();
    await db.insert(modelProviders).values({
      id,
      tenantId,
      name: input.name,
      presetKey: input.presetKey,
      baseUrl: input.baseUrl,
      apiKeyEnc: input.apiKeyEnc,
      timeoutMs: input.timeoutMs,
      enabled: input.enabled,
      notes: input.notes,
      modelsJson: input.modelsJson,
      createdBy: input.createdBy,
    });
    const created = await this.getProvider(tenantId, id);
    if (!created) throw new Error('provider create failed');
    return created;
  },
  async updateProvider(tenantId, id, patch) {
    const db = getDb();
    const [row] = await db
      .update(modelProviders)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.presetKey !== undefined ? { presetKey: patch.presetKey } : {}),
        ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
        ...(patch.apiKeyEnc !== undefined ? { apiKeyEnc: patch.apiKeyEnc } : {}),
        ...(patch.timeoutMs !== undefined ? { timeoutMs: patch.timeoutMs } : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.modelsJson !== undefined ? { modelsJson: patch.modelsJson } : {}),
        updatedBy: patch.updatedBy,
        updatedAt: formatLocalDateTime(),
      })
      .where(and(eq(modelProviders.tenantId, tenantId), eq(modelProviders.id, id)))
      .returning();
    return row ? mapProvider(row) : null;
  },
  async deleteProvider(tenantId, id) {
    const db = getDb();
    const deleted = await db
      .delete(modelProviders)
      .where(and(eq(modelProviders.tenantId, tenantId), eq(modelProviders.id, id)))
      .returning({ id: modelProviders.id });
    return deleted.length > 0;
  },
  async listPlatformBindings(tenantId) {
    const db = getDb();
    const rows = await db
      .select()
      .from(modelBindings)
      .where(
        and(
          eq(modelBindings.tenantId, tenantId),
          eq(modelBindings.scope, 'platform'),
          eq(modelBindings.scopeId, ''),
        ),
      );
    return rows.map(mapBinding);
  },
  async replacePlatformBindings(tenantId, rows, updatedBy) {
    const db = getDb();
    await db
      .delete(modelBindings)
      .where(
        and(
          eq(modelBindings.tenantId, tenantId),
          eq(modelBindings.scope, 'platform'),
          eq(modelBindings.scopeId, ''),
        ),
      );
    if (rows.length === 0) return [];
    const values = rows.map((r) => ({
      id: uuidv7(),
      tenantId,
      scope: 'platform' as const,
      scopeId: '',
      purpose: r.purpose,
      primaryRef: r.primaryRef,
      fallbackRefs: r.fallbackRefs,
      createdBy: updatedBy,
      updatedBy,
    }));
    await db.insert(modelBindings).values(values);
    return this.listPlatformBindings(tenantId);
  },
};

export function resolveTenantId(authTenantId?: string | null): string {
  return authTenantId?.trim() || DEV_DEFAULT_TENANT;
}

export type { ModelType, PutPlatformBindingsBody };
