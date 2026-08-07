'use client';

/**
 * 模型网关：本模块私有 HTTP。
 * path 仅此处；禁止 services/UI 写 URL。
 */

import type {
  CreateModelProviderBody,
  ModelCatalogItem,
  ModelProvider,
  ModelProviderPreset,
  PatchModelProviderBody,
  PlatformBindings,
  PutPlatformBindingsBody,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listModelProviders() {
  return http.get<ModelProvider[]>('/api/v1/admin/model-providers');
}

export async function createModelProvider(body: CreateModelProviderBody) {
  return http.post<ModelProvider, CreateModelProviderBody>(
    '/api/v1/admin/model-providers',
    body,
  );
}

export async function patchModelProvider(id: string, body: PatchModelProviderBody) {
  return http.patch<ModelProvider, PatchModelProviderBody>(
    `/api/v1/admin/model-providers/${id}`,
    body,
  );
}

export async function deleteModelProvider(id: string) {
  return http.delete<{ id: string; deleted: boolean }>(`/api/v1/admin/model-providers/${id}`);
}

export async function listModelPresets() {
  return http.get<ModelProviderPreset[]>('/api/v1/admin/model-providers/presets');
}

export async function getPlatformBindings() {
  return http.get<{ bindings: PlatformBindings }>('/api/v1/admin/model-bindings');
}

export async function putPlatformBindings(body: PutPlatformBindingsBody) {
  return http.put<{ bindings: PlatformBindings }, PutPlatformBindingsBody>(
    '/api/v1/admin/model-bindings',
    body,
  );
}

export async function getModelCatalog() {
  return http.get<ModelCatalogItem[]>('/api/v1/model-catalog');
}
