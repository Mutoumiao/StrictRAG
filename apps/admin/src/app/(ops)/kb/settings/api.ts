'use client';

/**
 * 知识库设置：本模块私有 HTTP。
 * path 仅此处；禁止 services/UI 写 URL。
 */

import type { KbSettings, PatchKbSettingsBody, PlatformBindings, PutPlatformBindingsBody } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function getKbSettings(kbId: string) {
  return http.get<KbSettings>(`/api/v1/knowledge-bases/${kbId}/settings`);
}

export async function patchKbSettings(kbId: string, body: PatchKbSettingsBody) {
  return http.patch<KbSettings>(`/api/v1/knowledge-bases/${kbId}/settings`, body);
}

export async function getKbModelBindings(kbId: string) {
  return http.get<{ bindings: PlatformBindings }>(
    `/api/v1/knowledge-bases/${kbId}/model-bindings`,
  );
}

export async function putKbModelBindings(kbId: string, body: PutPlatformBindingsBody) {
  return http.put<{ bindings: PlatformBindings }, PutPlatformBindingsBody>(
    `/api/v1/knowledge-bases/${kbId}/model-bindings`,
    body,
  );
}
