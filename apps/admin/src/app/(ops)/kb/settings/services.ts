'use client';

/**
 * 知识库设置用例：加载 / 保存（无 path；不做权限决策）。
 */

import type {
  KbSettings,
  KbSettingsAuditItem,
  PatchKbSettingsBody,
  PlatformBindings,
  PutPlatformBindingsBody,
} from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

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

export function parseDocTypesInput(raw: string): string[] {
  return raw
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function loadKbBindings(kbId: string) {
  try {
    const data = await getKbModelBindings(kbId);
    return { ok: true as const, bindings: data.bindings };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

export async function saveKbBindings(kbId: string, body: PutPlatformBindingsBody) {
  try {
    const data = await putKbModelBindings(kbId, body);
    return { ok: true as const, bindings: data.bindings };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

export type { PlatformBindings };
