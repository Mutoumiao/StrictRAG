/**
 * B3-W / B2-W：从 model_bindings / model_providers 加载快照。
 * 解析顺序：KB 绑定覆盖 platform → env 回退（单一 resolve，非第二 map）。
 */
import type { ModelGatewayRepo } from '../model-gateway.js';
import { modelGatewayRepo } from '../model-gateway.js';
import type { BindingSnapshotRow, ProviderSnapshotRow } from './resolve.js';

export type BindingLoadResult = {
  bindings: BindingSnapshotRow[];
  providers: ProviderSnapshotRow[];
};

const cache = new Map<string, { at: number; data: BindingLoadResult }>();
/** ponytail: 短 TTL；写绑定后最多 5s 旧配置（多实例各自缓存） */
const TTL_MS = 5_000;

export function clearBindingCache(): void {
  cache.clear();
}

function cacheKey(tenantId: string, kbId?: string): string {
  return kbId ? `${tenantId}::${kbId}` : tenantId;
}

/** 合并：platform 先，同 purpose 的 KB 后写覆盖 */
export function mergeBindingRows(
  platform: BindingSnapshotRow[],
  kb: BindingSnapshotRow[],
): BindingSnapshotRow[] {
  const map = new Map<string, BindingSnapshotRow>();
  for (const b of platform) map.set(b.purpose, b);
  for (const b of kb) map.set(b.purpose, b);
  return [...map.values()];
}

export async function loadPlatformBindingSnapshot(
  tenantId: string,
  repo: ModelGatewayRepo = modelGatewayRepo,
  kbId?: string,
): Promise<BindingLoadResult> {
  const now = Date.now();
  const key = cacheKey(tenantId, kbId);
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) {
    return hit.data;
  }
  const [platformRows, kbRows, providerRows] = await Promise.all([
    repo.listPlatformBindings(tenantId),
    kbId ? repo.listKbBindings(tenantId, kbId) : Promise.resolve([]),
    repo.listProviders(tenantId),
  ]);
  const platform = platformRows.map((b) => ({
    purpose: b.purpose,
    primaryRef: b.primaryRef,
  }));
  const kb = kbRows.map((b) => ({
    purpose: b.purpose,
    primaryRef: b.primaryRef,
  }));
  const data: BindingLoadResult = {
    bindings: mergeBindingRows(platform, kb),
    providers: providerRows.map((p) => ({
      id: p.id,
      baseUrl: p.baseUrl,
      apiKeyEnc: p.apiKeyEnc,
      enabled: p.enabled,
      timeoutMs: p.timeoutMs,
      modelsJson: p.modelsJson ?? [],
    })),
  };
  cache.set(key, { at: now, data });
  return data;
}
