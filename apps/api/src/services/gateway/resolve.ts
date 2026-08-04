import { GatewayConfigError } from './errors.js';

export type GatewayMode = 'mock' | 'http';

export type ChatPurpose =
  | 'generate'
  | 'claim_split'
  | 'judge'
  | 'route'
  | 'rewrite'
  | 'other';

export type GatewayConfig = {
  mode: GatewayMode;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
  /** purpose → model（P2 静态/env；供应商 UI → 后续） */
  models: {
    chat: string;
    embed: string;
    rerank: string;
  };
  embedDims: number;
  /** rerank 节点 URL 列表（mock 为 mock://…） */
  rerankEndpoints: string[];
  rerankMinNodes: number;
};

export type GatewayEnvSlice = {
  APP_ENV: 'development' | 'test' | 'staging' | 'production';
  GATEWAY_MODE?: 'mock' | 'http' | '';
  GATEWAY_BASE_URL: string;
  GATEWAY_API_KEY: string;
  GATEWAY_TIMEOUT_MS?: number;
  GATEWAY_MAX_ATTEMPTS?: number;
  GATEWAY_CHAT_MODEL?: string;
  GATEWAY_EMBED_MODEL?: string;
  GATEWAY_RERANK_MODEL?: string;
  GATEWAY_EMBED_DIMS?: number;
  GATEWAY_RERANK_FALLBACK_URL?: string;
  RERANK_MIN_NODES?: number;
};

function defaultMode(env: GatewayEnvSlice): GatewayMode {
  if (env.GATEWAY_MODE === 'mock' || env.GATEWAY_MODE === 'http') {
    return env.GATEWAY_MODE;
  }
  // 未显式：有 baseUrl → http；否则 mock（CI/本地无上游）
  return env.GATEWAY_BASE_URL.trim() ? 'http' : 'mock';
}

function defaultRerankMinNodes(appEnv: GatewayEnvSlice['APP_ENV']): number {
  return appEnv === 'staging' || appEnv === 'production' ? 2 : 1;
}

/**
 * 从 env 切片构建配置并校验 RERANK_MIN_NODES。
 * 纯函数，便于单测；不在 import 时强绑 process.env。
 */
export function buildGatewayConfig(env: GatewayEnvSlice): GatewayConfig {
  const mode = defaultMode(env);
  const minNodes = env.RERANK_MIN_NODES ?? defaultRerankMinNodes(env.APP_ENV);
  const timeoutMs = env.GATEWAY_TIMEOUT_MS ?? 60_000;
  const maxAttempts = env.GATEWAY_MAX_ATTEMPTS ?? 2;

  const baseUrl = env.GATEWAY_BASE_URL.replace(/\/$/, '');
  const fallback = (env.GATEWAY_RERANK_FALLBACK_URL ?? '').replace(/\/$/, '');

  let rerankEndpoints: string[];
  if (mode === 'mock') {
    rerankEndpoints = Array.from({ length: Math.max(minNodes, 1) }, (_, i) => `mock://rerank-${i}`);
  } else {
    rerankEndpoints = [baseUrl, fallback].filter((u) => u.length > 0);
  }

  if (rerankEndpoints.length < minNodes) {
    throw new GatewayConfigError(
      `RERANK_MIN_NODES=${minNodes} but only ${rerankEndpoints.length} rerank endpoint(s); set GATEWAY_RERANK_FALLBACK_URL or lower min in non-prod`,
    );
  }

  if (mode === 'http' && !baseUrl) {
    throw new GatewayConfigError('GATEWAY_MODE=http requires GATEWAY_BASE_URL');
  }

  return {
    mode,
    baseUrl,
    apiKey: env.GATEWAY_API_KEY,
    timeoutMs,
    maxAttempts,
    models: {
      chat: env.GATEWAY_CHAT_MODEL ?? 'gpt-4o-mini',
      embed: env.GATEWAY_EMBED_MODEL ?? 'text-embedding-3-small',
      rerank: env.GATEWAY_RERANK_MODEL ?? 'bge-reranker-v2-m3',
    },
    embedDims: env.GATEWAY_EMBED_DIMS ?? 8,
    rerankEndpoints,
    rerankMinNodes: minNodes,
  };
}

export function resolveChatModel(cfg: GatewayConfig, _purpose: ChatPurpose, override?: string): string {
  return override ?? cfg.models.chat;
}

export function resolveEmbedModel(cfg: GatewayConfig, override?: string): string {
  return override ?? cfg.models.embed;
}

export function resolveRerankModel(cfg: GatewayConfig, override?: string): string {
  return override ?? cfg.models.rerank;
}
