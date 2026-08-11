import { env } from '../../env.js';
import { clearBindingCache, loadPlatformBindingSnapshot } from './bindings.js';
import { createHttpGateway } from './http-client.js';
import { createMockGateway } from './mock-client.js';
import {
  applyBindingsToGatewayConfig,
  buildGatewayConfig,
  type GatewayConfig,
  type GatewayEnvSlice,
} from './resolve.js';
import type { GatewayClient } from './types.js';

export type { GatewayClient, ChatRequest, ChatResult, RerankHit } from './types.js';
export type { GatewayConfig, ChatPurpose } from './resolve.js';

function envSlice(): GatewayEnvSlice {
  return {
    APP_ENV: env.APP_ENV,
    GATEWAY_MODE: env.GATEWAY_MODE,
    GATEWAY_BASE_URL: env.GATEWAY_BASE_URL,
    GATEWAY_API_KEY: env.GATEWAY_API_KEY,
    GATEWAY_TIMEOUT_MS: env.GATEWAY_TIMEOUT_MS,
    GATEWAY_MAX_ATTEMPTS: env.GATEWAY_MAX_ATTEMPTS,
    GATEWAY_CHAT_MODEL: env.GATEWAY_CHAT_MODEL,
    GATEWAY_EMBED_MODEL: env.GATEWAY_EMBED_MODEL,
    GATEWAY_RERANK_MODEL: env.GATEWAY_RERANK_MODEL,
    GATEWAY_EMBED_DIMS: env.GATEWAY_EMBED_DIMS,
    GATEWAY_RERANK_FALLBACK_URL: env.GATEWAY_RERANK_FALLBACK_URL,
    RERANK_MIN_NODES: env.RERANK_MIN_NODES,
  };
}

/** 从配置创建 client（测例可直接传 cfg） */
export function createGateway(cfg: GatewayConfig, fetchImpl?: typeof fetch): GatewayClient {
  if (cfg.mode === 'mock') {
    return createMockGateway(cfg);
  }
  return createHttpGateway({ cfg, fetchImpl });
}

let cached: GatewayClient | null = null;
let cachedCfg: GatewayConfig | null = null;

const tenantCache = new Map<string, { at: number; client: GatewayClient; cfg: GatewayConfig }>();
const TENANT_TTL_MS = 5_000;

/** 进程内单例；仅 env（兼容旧路径 / 单测） */
export function getGateway(): GatewayClient {
  if (!cached) {
    cachedCfg = buildGatewayConfig(envSlice());
    cached = createGateway(cachedCfg);
  }
  return cached;
}

/**
 * B3-W：tenant 级 gateway = env + platform 绑定。
 * 失败回退 env（不抛，保证 ask 可继续 mock/env）。
 */
export async function getGatewayForTenant(tenantId: string): Promise<GatewayClient> {
  const now = Date.now();
  const hit = tenantCache.get(tenantId);
  if (hit && now - hit.at < TENANT_TTL_MS) {
    return hit.client;
  }
  const envCfg = buildGatewayConfig(envSlice());
  let cfg = envCfg;
  try {
    const snap = await loadPlatformBindingSnapshot(tenantId);
    cfg = applyBindingsToGatewayConfig(envCfg, snap);
  } catch {
    cfg = envCfg;
  }
  const client = createGateway(cfg);
  tenantCache.set(tenantId, { at: now, client, cfg });
  return client;
}

export async function getGatewayConfigForTenant(tenantId: string): Promise<GatewayConfig> {
  await getGatewayForTenant(tenantId);
  return tenantCache.get(tenantId)?.cfg ?? buildGatewayConfig(envSlice());
}

/** 测试用：清单例 */
export function resetGatewayForTests(): void {
  cached = null;
  cachedCfg = null;
  tenantCache.clear();
  clearBindingCache();
}

export function getGatewayConfig(): GatewayConfig {
  if (!cachedCfg) {
    cachedCfg = buildGatewayConfig(envSlice());
  }
  return cachedCfg;
}
