import { env } from '../../env.js';
import { createHttpGateway } from './http-client.js';
import { createMockGateway } from './mock-client.js';
import { buildGatewayConfig, type GatewayConfig, type GatewayEnvSlice } from './resolve.js';
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

/** 进程内单例；读当前 env */
export function getGateway(): GatewayClient {
  if (!cached) {
    cachedCfg = buildGatewayConfig(envSlice());
    cached = createGateway(cachedCfg);
  }
  return cached;
}

/** 测试用：清单例 */
export function resetGatewayForTests(): void {
  cached = null;
  cachedCfg = null;
}

export function getGatewayConfig(): GatewayConfig {
  if (!cachedCfg) {
    cachedCfg = buildGatewayConfig(envSlice());
  }
  return cachedCfg;
}
