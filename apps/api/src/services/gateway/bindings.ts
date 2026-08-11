/**
 * B3-W：从 model_bindings / model_providers 加载 platform 快照。
 * 与 admin model-gateway 同源表，非第二 purpose map。
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

export async function loadPlatformBindingSnapshot(
  tenantId: string,
  repo: ModelGatewayRepo = modelGatewayRepo,
): Promise<BindingLoadResult> {
  const now = Date.now();
  const hit = cache.get(tenantId);
  if (hit && now - hit.at < TTL_MS) {
    return hit.data;
  }
  const [bindingRows, providerRows] = await Promise.all([
    repo.listPlatformBindings(tenantId),
    repo.listProviders(tenantId),
  ]);
  const data: BindingLoadResult = {
    bindings: bindingRows.map((b) => ({
      purpose: b.purpose,
      primaryRef: b.primaryRef,
    })),
    providers: providerRows.map((p) => ({
      id: p.id,
      baseUrl: p.baseUrl,
      apiKeyEnc: p.apiKeyEnc,
      enabled: p.enabled,
      timeoutMs: p.timeoutMs,
      modelsJson: p.modelsJson ?? [],
    })),
  };
  cache.set(tenantId, { at: now, data });
  return data;
}
