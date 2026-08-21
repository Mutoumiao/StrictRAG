'use client';

/**
 * 知识库设置用例：加载 / 保存（无 path；不做权限决策）。
 */

import type { KbSettings, PatchKbSettingsBody, PlatformBindings, PutPlatformBindingsBody } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { getKbModelBindings, getKbSettings, patchKbSettings, putKbModelBindings } from './api';

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
