import {
  GatewayError,
  kindFromHttpStatus,
  type GatewayPurpose,
} from './errors.js';
import type { GatewayConfig } from './resolve.js';
import { resolveChatModel, resolveEmbedModel, resolveRerankModel } from './resolve.js';
import { withSameModelRetry } from './retry.js';
import type { ChatRequest, ChatResult, GatewayClient, RerankHit } from './types.js';

export type FetchLike = typeof fetch;

type HttpGatewayOptions = {
  cfg: GatewayConfig;
  fetchImpl?: FetchLike;
};

async function httpJson(params: {
  fetchImpl: FetchLike;
  url: string;
  apiKey: string;
  body: unknown;
  timeoutMs: number;
  purpose: GatewayPurpose;
  attempt: number;
  model: string;
}): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), params.timeoutMs);
  try {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (params.apiKey) {
      headers.Authorization = `Bearer ${params.apiKey}`;
    }
    const res = await params.fetchImpl(params.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params.body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new GatewayError(
        kindFromHttpStatus(res.status),
        `gateway ${params.purpose} HTTP ${res.status}: ${text.slice(0, 200)}`,
        params.purpose,
        { attempt: params.attempt, status: res.status, model: params.model },
      );
    }
    return await res.json();
  } catch (err) {
    if (err instanceof GatewayError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GatewayError('timeout', `gateway ${params.purpose} timeout`, params.purpose, {
        attempt: params.attempt,
        model: params.model,
      });
    }
    throw new GatewayError(
      'network',
      `gateway ${params.purpose} network: ${err instanceof Error ? err.message : String(err)}`,
      params.purpose,
      { attempt: params.attempt, model: params.model },
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OpenAI 兼容 HTTP 客户端。
 * - chat → POST /v1/chat/completions
 * - embed → POST /v1/embeddings
 * - rerank → POST /v1/rerank（Jina/兼容：{ query, documents, top_n }）
 */
export function createHttpGateway(options: HttpGatewayOptions): GatewayClient {
  const { cfg } = options;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const base = cfg.baseUrl.replace(/\/$/, '');

  return {
    async chat(req: ChatRequest): Promise<ChatResult> {
      const model = resolveChatModel(cfg, req.purpose, req.model);
      const timeoutMs = req.timeoutMs ?? cfg.timeoutMs;
      const started = Date.now();
      return withSameModelRetry({
        purpose: 'chat',
        maxAttempts: cfg.maxAttempts,
        run: async (attempt) => {
          const data = (await httpJson({
            fetchImpl,
            url: `${base}/chat/completions`,
            apiKey: cfg.apiKey,
            timeoutMs,
            purpose: 'chat',
            attempt,
            model,
            body: {
              model,
              messages: req.messages,
              temperature: req.temperature ?? 0,
              max_tokens: req.maxTokens,
            },
          })) as {
            choices?: { message?: { content?: string } }[];
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          const text = data.choices?.[0]?.message?.content ?? '';
          if (!text) {
            throw new GatewayError('unavailable', 'chat: empty content', 'chat', {
              attempt,
              model,
            });
          }
          return {
            text,
            usage: data.usage
              ? {
                  promptTokens: data.usage.prompt_tokens ?? 0,
                  completionTokens: data.usage.completion_tokens ?? 0,
                }
              : undefined,
            meta: {
              provider: 'http',
              model,
              attempt,
              fallbackUsed: false,
              latencyMs: Date.now() - started,
            },
          };
        },
      });
    },

    async embed(texts: string[], model?: string): Promise<number[][]> {
      const m = resolveEmbedModel(cfg, model);
      return withSameModelRetry({
        purpose: 'embed',
        maxAttempts: cfg.maxAttempts,
        run: async (attempt) => {
          if (texts.length === 0) {
            throw new GatewayError('bad_request', 'embed: empty texts', 'embed', {
              attempt,
              model: m,
            });
          }
          const data = (await httpJson({
            fetchImpl,
            url: `${base}/embeddings`,
            apiKey: cfg.apiKey,
            timeoutMs: cfg.timeoutMs,
            purpose: 'embed',
            attempt,
            model: m,
            body: { model: m, input: texts },
          })) as { data?: { embedding: number[]; index: number }[] };
          const rows = data.data ?? [];
          if (rows.length !== texts.length) {
            throw new GatewayError('unavailable', 'embed: length mismatch', 'embed', {
              attempt,
              model: m,
            });
          }
          return [...rows].sort((a, b) => a.index - b.index).map((r) => r.embedding);
        },
      });
    },

    async rerank(query: string, passages: string[], topN = 10, model?: string): Promise<RerankHit[]> {
      const m = resolveRerankModel(cfg, model);
      const endpoints =
        cfg.rerankEndpoints.length > 0 ? cfg.rerankEndpoints : [base];
      let last: GatewayError | undefined;

      for (let ei = 0; ei < endpoints.length; ei++) {
        const ep = endpoints[ei]!.replace(/\/$/, '');
        try {
          return await withSameModelRetry({
            purpose: 'rerank',
            maxAttempts: cfg.maxAttempts,
            run: async (attempt) => {
              if (passages.length === 0) {
                throw new GatewayError('bad_request', 'rerank: empty passages', 'rerank', {
                  attempt,
                  model: m,
                });
              }
              const data = (await httpJson({
                fetchImpl,
                url: `${ep}/rerank`,
                apiKey: cfg.apiKey,
                timeoutMs: cfg.timeoutMs,
                purpose: 'rerank',
                attempt,
                model: m,
                body: {
                  model: m,
                  query,
                  documents: passages,
                  top_n: topN,
                },
              })) as {
                results?: { index: number; relevance_score?: number; score?: number }[];
              };
              const results = data.results ?? [];
              if (results.length === 0) {
                throw new GatewayError('unavailable', 'rerank: empty results', 'rerank', {
                  attempt,
                  model: m,
                });
              }
              return results.map((r) => ({
                index: r.index,
                score: r.relevance_score ?? r.score ?? 0,
              }));
            },
          });
        } catch (err) {
          if (!(err instanceof GatewayError)) throw err;
          last = err;
        }
      }

      throw (
        last ??
        new GatewayError('exhausted', 'rerank: chain exhausted', 'rerank', { model: m })
      );
    },
  };
}
