'use client';

/**
 * 模型网关用例：列表/创建/绑定（无 path；不做权限决策）。
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

import { mapBizError } from '@/lib/map-biz-error';

import {
  createModelProvider,
  deleteModelProvider,
  getModelCatalog,
  getPlatformBindings,
  listModelPresets,
  listModelProviders,
  patchModelProvider,
  putPlatformBindings,
} from './api';

export type LoadGatewayResult =
  | {
      ok: true;
      providers: ModelProvider[];
      presets: ModelProviderPreset[];
      bindings: PlatformBindings;
      catalog: ModelCatalogItem[];
    }
  | { ok: false; message: string };

export async function loadModelGateway(): Promise<LoadGatewayResult> {
  try {
    const [providers, presets, bindingWrap, catalog] = await Promise.all([
      listModelProviders(),
      listModelPresets(),
      getPlatformBindings(),
      getModelCatalog(),
    ]);
    return {
      ok: true,
      providers,
      presets,
      bindings: bindingWrap.bindings ?? {},
      catalog,
    };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function createProvider(
  body: CreateModelProviderBody,
): Promise<{ ok: true; provider: ModelProvider } | { ok: false; message: string }> {
  try {
    const provider = await createModelProvider(body);
    return { ok: true, provider };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function updateProvider(
  id: string,
  body: PatchModelProviderBody,
): Promise<{ ok: true; provider: ModelProvider } | { ok: false; message: string }> {
  try {
    const provider = await patchModelProvider(id, body);
    return { ok: true, provider };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function removeProvider(
  id: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await deleteModelProvider(id);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function saveBindings(
  body: PutPlatformBindingsBody,
): Promise<{ ok: true; bindings: PlatformBindings } | { ok: false; message: string }> {
  try {
    const r = await putPlatformBindings(body);
    return { ok: true, bindings: r.bindings ?? {} };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
