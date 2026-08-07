'use client';

/**
 * 知识库设置用例：加载 / 保存（无 path；不做权限决策）。
 */

import type { KbSettings, PatchKbSettingsBody } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { getKbSettings, patchKbSettings } from './api';

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
