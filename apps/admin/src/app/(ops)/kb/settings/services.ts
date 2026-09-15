'use client';

/**
 * 知识库设置用例：加载 / 保存（无 path；不做权限决策）。
 */

import type {
  KbConsumePurpose,
  KbDocTypeCatalogItem,
  KbSettings,
  KbSettingsAuditItem,
  ModelCatalogItem,
  PatchKbSettingsBody,
  PlatformBindings,
  PutKbConsumeBindingsBody,
} from '@strict-rag/contracts';
import { KB_CONSUME_PURPOSES, requiredModelTypeForPurpose } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';
import { ApiHttpError } from '@/lib/http';
import { getModelCatalog } from '../../models/api';

import {
  getKbModelBindings,
  getKbSettings,
  listKbSettingsAudit,
  patchKbSettings,
  putKbModelBindings,
} from './api';

export const NO_SETTINGS_AUDIT_HINT = '暂无修改日志';

export type LoadSettingsResult =
  | { ok: true; settings: KbSettings }
  | { ok: false; message: string };

export type SaveSettingsResult =
  | { ok: true; settings: KbSettings; text: string }
  | { ok: false; message: string };

export async function loadKbSettings(kbId: string): Promise<LoadSettingsResult> {
  try {
    const settings = await getKbSettings(kbId);
    return { ok: true, settings };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function saveKbSettings(
  kbId: string,
  body: PatchKbSettingsBody,
): Promise<SaveSettingsResult> {
  try {
    const settings = await patchKbSettings(kbId, body);
    return { ok: true, settings, text: '已保存' };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export type LoadSettingsAuditResult =
  | { ok: true; items: KbSettingsAuditItem[] }
  | { ok: false; message: string; items: KbSettingsAuditItem[] };

export async function loadKbSettingsAudit(kbId: string): Promise<LoadSettingsAuditResult> {
  try {
    const items = await listKbSettingsAudit(kbId);
    return { ok: true, items };
  } catch (err) {
    return { ok: false, message: mapBizError(err), items: [] };
  }
}

export function formatSettingsAuditValue(value: unknown): string {
  if (value === undefined) return '—';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export type DocTypeDraft = {
  code: string;
  label: string;
  enabled: boolean;
};

export function catalogToDrafts(items: readonly KbDocTypeCatalogItem[]): DocTypeDraft[] {
  return items
    .slice()
    .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code))
    .map((item) => ({ code: item.code, label: item.label, enabled: item.enabled }));
}

export function draftsFromEnabledCodes(codes: readonly string[]): DocTypeDraft[] {
  return codes.map((code) => ({ code, label: code, enabled: true }));
}

export function draftsFromSettings(settings: Pick<KbSettings, 'docTypes' | 'docTypeItems'>): DocTypeDraft[] {
  const items = settings.docTypeItems ?? [];
  if (items.length > 0) return catalogToDrafts(items);
  return draftsFromEnabledCodes(settings.docTypes ?? []);
}

export function draftsToCatalog(drafts: readonly DocTypeDraft[]): KbDocTypeCatalogItem[] {
  const out: KbDocTypeCatalogItem[] = [];
  const seen = new Set<string>();
  for (const draft of drafts) {
    const code = draft.code.trim();
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push({
      code,
      label: (draft.label.trim() || code).slice(0, 128),
      sort: out.length,
      enabled: draft.enabled,
    });
  }
  return out;
}

export function catalogsEqual(
  left: readonly KbDocTypeCatalogItem[],
  right: readonly KbDocTypeCatalogItem[],
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function loadKbBindings(kbId: string) {
  try {
    const data = await getKbModelBindings(kbId);
    return { ok: true as const, bindings: data.bindings };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

export async function saveKbBindings(kbId: string, body: PutKbConsumeBindingsBody) {
  try {
    const data = await putKbModelBindings(kbId, body);
    return { ok: true as const, bindings: data.bindings };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

export type KbConsumeDrafts = Record<KbConsumePurpose, string>;

export function emptyKbConsumeDrafts(): KbConsumeDrafts {
  return { generate: '', embed: '', rerank: '' };
}

export function draftsFromKbBindings(bindings: PlatformBindings): KbConsumeDrafts {
  return {
    generate: bindings.generate?.primary ?? '',
    embed: bindings.embed?.primary ?? '',
    rerank: bindings.rerank?.primary ?? '',
  };
}

export function draftsToKbConsumeBindings(drafts: KbConsumeDrafts): PutKbConsumeBindingsBody {
  const bindings: PutKbConsumeBindingsBody['bindings'] = {};
  for (const purpose of KB_CONSUME_PURPOSES) {
    const ref = drafts[purpose].trim();
    if (ref) bindings[purpose] = { primary: ref };
  }
  return { bindings };
}

export function kbConsumeDraftsEqual(left: KbConsumeDrafts, right: KbConsumeDrafts): boolean {
  return KB_CONSUME_PURPOSES.every((purpose) => left[purpose] === right[purpose]);
}

export async function loadModelCatalog(): Promise<
  { ok: true; items: ModelCatalogItem[] } | { ok: false; items: []; message: string }
> {
  try {
    const items = await getModelCatalog();
    return { ok: true, items };
  } catch (err) {
    if (err instanceof ApiHttpError && err.code === 'FORBIDDEN') {
      return { ok: false, items: [], message: err.message };
    }
    return { ok: false, items: [], message: mapBizError(err) };
  }
}

export function catalogOptionsForPurpose(
  purpose: KbConsumePurpose,
  catalog: ModelCatalogItem[],
  currentRef: string,
): Array<{ value: string; label: string }> {
  const need = requiredModelTypeForPurpose(purpose);
  const options: Array<{ value: string; label: string }> = [{ value: '', label: '跟随平台' }];
  for (const item of catalog) {
    if (item.type !== need) continue;
    options.push({ value: item.ref, label: `${item.providerName} · ${item.modelName}` });
  }
  const trimmed = currentRef.trim();
  if (trimmed && !options.some((o) => o.value === trimmed)) {
    options.push({ value: trimmed, label: trimmed });
  }
  return options;
}

export type { PlatformBindings };
