import { parseModelRef } from '@strict-rag/contracts';

import { GatewayConfigError } from './errors.js';

export type GatewayMode = 'mock' | 'http';

export type ChatPurpose =
  | 'generate'
  | 'claim_split'
  | 'judge'
  | 'route'
  | 'rewrite'
  | 'other';

/** 单 purpose 运行时端点（来自 DB provider；密钥勿日志） */
export type PurposeEndpoint = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type GatewayConfig = {
  mode: GatewayMode;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  maxAttempts: number;
  /** env / 回退后的默认模型名 */
  models: {
    chat: string;
    embed: string;
    rerank: string;
  };
  /**
   * B3-W：按 chat purpose 的模型名（DB 绑定优先）。
   * 缺省走 models.chat。
   */
  purposeModels?: Partial<Record<ChatPurpose, string>>;
  /** B3-W：按通道的 baseUrl/apiKey/model（DB provider） */
  purposeEndpoints?: Partial<Record<'chat' | 'embed' | 'rerank', PurposeEndpoint>>;
  /** env | db | mixed — 签字 profile 用 */
  bindingSource: 'env' | 'db' | 'mixed';
  embedDims: number;
  /** rerank 节点 URL 列表（mock 为 mock://…） */
  rerankEndpoints: string[];
  rerankMinNodes: number;
  /**
   * generate 备用 chat 节点（opt-in；空 = 不切链）。
   * 与 rerankEndpoints 不同：这里是 ModelRef 解析出的 model+endpoint，不是第二 URL。
   */
  generateFallbacks?: PurposeEndpoint[];
};

/** DB 绑定快照（与 model-gateway 表同源，非第二 map） */
export type BindingSnapshotRow = {
  purpose: string;
  primaryRef: string;
  /** generate 等 purpose 的备用 ModelRef；快照不得丢 */
  fallbackRefs?: string[];
};

export type ProviderSnapshotRow = {
  id: string;
  baseUrl: string;
  apiKeyEnc: string | null;
  enabled: number;
  timeoutMs: number;
  modelsJson: Array<{ name: string; type: string; enabled: boolean; dimensions?: number }>;
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
    bindingSource: 'env',
    embedDims: env.GATEWAY_EMBED_DIMS ?? 8,
    rerankEndpoints,
    rerankMinNodes: minNodes,
  };
}

function findEnabledModel(
  providers: ProviderSnapshotRow[],
  ref: string,
): { provider: ProviderSnapshotRow; modelName: string; dimensions?: number; type: string } | null {
  const parsed = parseModelRef(ref);
  if (!parsed) return null;
  const provider = providers.find((p) => p.id === parsed.providerId && p.enabled === 1);
  if (!provider) return null;
  const model = (provider.modelsJson ?? []).find((m) => m.name === parsed.modelName && m.enabled);
  if (!model) return null;
  return {
    provider,
    modelName: model.name,
    dimensions: model.dimensions,
    type: model.type,
  };
}

function endpointKey(ep: PurposeEndpoint): string {
  return `${ep.baseUrl}|${ep.model}`;
}

/** 解析 generate 绑定上的备用 ModelRef；无效/非 llm/与 primary 重复则跳过。 */
function resolveGenerateFallbacks(
  providers: ProviderSnapshotRow[],
  primary: PurposeEndpoint | undefined,
  fallbackRefs: string[] | undefined,
): PurposeEndpoint[] {
  if (!primary || !fallbackRefs?.length) return [];
  const seen = new Set([endpointKey(primary)]);
  const out: PurposeEndpoint[] = [];
  for (const ref of fallbackRefs) {
    const found = findEnabledModel(providers, ref);
    if (!found || found.type !== 'llm') continue;
    const ep: PurposeEndpoint = {
      baseUrl: found.provider.baseUrl.replace(/\/$/, ''),
      apiKey: found.provider.apiKeyEnc ?? '',
      model: found.modelName,
    };
    const key = endpointKey(ep);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ep);
  }
  return out;
}

/**
 * 将绑定叠到 env 配置（单一 resolve SSOT）。
 * 调用方已按 KB→platform 合并 bindings；此处 DB primary ref → env 回退。
 */
export function applyBindingsToGatewayConfig(
  envCfg: GatewayConfig,
  input: {
    bindings: BindingSnapshotRow[];
    providers: ProviderSnapshotRow[];
  },
): GatewayConfig {
  if (!input.bindings.length || !input.providers.length) {
    return { ...envCfg, bindingSource: 'env', generateFallbacks: undefined };
  }

  const byPurpose = new Map(input.bindings.map((b) => [b.purpose, b.primaryRef]));
  const purposeModels: Partial<Record<ChatPurpose, string>> = {};
  const purposeEndpoints: NonNullable<GatewayConfig['purposeEndpoints']> = {};
  let hit = 0;

  const applyChannel = (
    channel: 'chat' | 'embed' | 'rerank',
    purposeKey: string,
    chatPurposes?: ChatPurpose[],
  ) => {
    const ref = byPurpose.get(purposeKey);
    if (!ref) return;
    const found = findEnabledModel(input.providers, ref);
    if (!found) return;
    hit += 1;
    purposeEndpoints[channel] = {
      baseUrl: found.provider.baseUrl.replace(/\/$/, ''),
      apiKey: found.provider.apiKeyEnc ?? '',
      model: found.modelName,
    };
    if (channel === 'chat' && chatPurposes) {
      for (const p of chatPurposes) {
        purposeModels[p] = found.modelName;
      }
    }
  };

  // generate 覆盖默认 chat；专用 purpose 可再覆盖
  applyChannel('chat', 'generate', [
    'generate',
    'claim_split',
    'judge',
    'route',
    'rewrite',
    'other',
  ]);
  for (const p of ['claim_split', 'judge', 'route', 'rewrite'] as ChatPurpose[]) {
    const ref = byPurpose.get(p);
    if (!ref) continue;
    const found = findEnabledModel(input.providers, ref);
    if (!found) continue;
    hit += 1;
    purposeModels[p] = found.modelName;
  }
  applyChannel('embed', 'embed');
  applyChannel('rerank', 'rerank');

  if (hit === 0) {
    return { ...envCfg, bindingSource: 'env', generateFallbacks: undefined };
  }

  const models = { ...envCfg.models };
  if (purposeEndpoints.chat) models.chat = purposeEndpoints.chat.model;
  if (purposeEndpoints.embed) models.embed = purposeEndpoints.embed.model;
  if (purposeEndpoints.rerank) models.rerank = purposeEndpoints.rerank.model;

  // 顶层 base/apiKey：优先 generate/chat 绑定 provider；mode 仍尊重 env（禁偷偷切 http）
  let baseUrl = envCfg.baseUrl;
  let apiKey = envCfg.apiKey;
  let timeoutMs = envCfg.timeoutMs;
  if (purposeEndpoints.chat?.baseUrl) {
    baseUrl = purposeEndpoints.chat.baseUrl;
    apiKey = purposeEndpoints.chat.apiKey;
    const genRef = byPurpose.get('generate');
    const gen = genRef ? findEnabledModel(input.providers, genRef) : null;
    if (gen?.provider.timeoutMs) timeoutMs = gen.provider.timeoutMs;
  }

  let embedDims = envCfg.embedDims;
  const embRef = byPurpose.get('embed');
  if (embRef) {
    const emb = findEnabledModel(input.providers, embRef);
    if (emb?.dimensions && emb.dimensions > 0) embedDims = emb.dimensions;
  }

  let rerankEndpoints = envCfg.rerankEndpoints;
  if (purposeEndpoints.rerank?.baseUrl && envCfg.mode === 'http') {
    const primary = purposeEndpoints.rerank.baseUrl;
    const rest = envCfg.rerankEndpoints.filter((u) => u !== primary);
    rerankEndpoints = [primary, ...rest];
  }

  const genRow = input.bindings.find((b) => b.purpose === 'generate');
  const generateFallbacks = resolveGenerateFallbacks(
    input.providers,
    purposeEndpoints.chat,
    genRow?.fallbackRefs,
  );

  return {
    ...envCfg,
    baseUrl,
    apiKey,
    timeoutMs,
    models,
    purposeModels,
    purposeEndpoints,
    embedDims,
    rerankEndpoints,
    generateFallbacks: generateFallbacks.length ? generateFallbacks : undefined,
    bindingSource: envCfg.bindingSource === 'env' ? 'mixed' : 'db',
  };
}

export function resolveChatModel(cfg: GatewayConfig, purpose: ChatPurpose, override?: string): string {
  if (override) return override;
  return cfg.purposeModels?.[purpose] ?? cfg.models.chat;
}

/**
 * chat 节点链：仅 generate 且无 model 覆盖时带上 generateFallbacks。
 * 其它 purpose / 显式 override 只有 primary。
 */
export function resolveChatNodes(
  cfg: GatewayConfig,
  purpose: ChatPurpose,
  override?: string,
): PurposeEndpoint[] {
  const primary: PurposeEndpoint = {
    ...resolveEndpoint(cfg, 'chat'),
    model: resolveChatModel(cfg, purpose, override),
  };
  if (override || purpose !== 'generate') return [primary];
  const extras = cfg.generateFallbacks ?? [];
  if (extras.length === 0) return [primary];
  const seen = new Set([endpointKey(primary)]);
  const out: PurposeEndpoint[] = [primary];
  for (const fb of extras) {
    const key = endpointKey(fb);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(fb);
  }
  return out;
}

export function resolveEmbedModel(cfg: GatewayConfig, override?: string): string {
  if (override) return override;
  return cfg.purposeEndpoints?.embed?.model ?? cfg.models.embed;
}

export function resolveRerankModel(cfg: GatewayConfig, override?: string): string {
  if (override) return override;
  return cfg.purposeEndpoints?.rerank?.model ?? cfg.models.rerank;
}

/** http 调用选端点：purpose 通道优先，否则顶层 */
export function resolveEndpoint(
  cfg: GatewayConfig,
  channel: 'chat' | 'embed' | 'rerank',
): { baseUrl: string; apiKey: string } {
  const ep = cfg.purposeEndpoints?.[channel];
  if (ep?.baseUrl) {
    return { baseUrl: ep.baseUrl, apiKey: ep.apiKey };
  }
  return { baseUrl: cfg.baseUrl, apiKey: cfg.apiKey };
}
