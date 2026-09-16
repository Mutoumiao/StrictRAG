import { recordRerankAttemptFail, recordRerankNodeUsed } from '../../obs/metrics.js';
import { canTryGenerateFallback, GatewayError } from './errors.js';
import type { GatewayConfig } from './resolve.js';
import { resolveChatNodes, resolveEmbedModel, resolveRerankModel } from './resolve.js';
import { withSameModelRetry } from './retry.js';
import type { ChatRequest, ChatResult, GatewayClient, RerankHit } from './types.js';

/** 稳定伪向量（同文本同向量；维度与 cfg.embedDims 一致） */
export function mockEmbedVector(text: string, dims: number): number[] {
  const out: number[] = Array.from({ length: dims }, () => 0);
  for (let i = 0; i < text.length; i++) {
    const idx = i % dims;
    out[idx] = (out[idx] ?? 0) + (text.charCodeAt(i) % 31) / 31;
  }
  const norm = Math.sqrt(out.reduce((s, v) => s + v * v, 0)) || 1;
  return out.map((v) => v / norm);
}

function overlapScore(query: string, passage: string): number {
  const q = new Set(query.toLowerCase().split(/\s+/).filter(Boolean));
  if (q.size === 0) return 0;
  const p = passage.toLowerCase();
  let hit = 0;
  for (const w of q) {
    if (p.includes(w)) hit += 1;
  }
  return hit / q.size;
}

export type MockGatewayHooks = {
  /** 注入失败：attempt 为节点内同模型重试序号；nodeIndex 为 generate 链档位（0=primary） */
  failChat?: (attempt: number, nodeIndex?: number) => GatewayError | null;
  failEmbed?: (attempt: number) => GatewayError | null;
  failRerank?: (attempt: number, endpointIndex: number) => GatewayError | null;
};

/**
 * 进程内 mock Gateway（CI / 无上游）。
 * rerank 仍走「接口」语义：可注入全链失败 → exhausted / unavailable。
 */
export function createMockGateway(cfg: GatewayConfig, hooks: MockGatewayHooks = {}): GatewayClient {
  return {
    async chat(req: ChatRequest): Promise<ChatResult> {
      const nodes = resolveChatNodes(cfg, req.purpose, req.model);
      const started = Date.now();
      let last: GatewayError | undefined;

      for (let ni = 0; ni < nodes.length; ni++) {
        const model = nodes[ni]!.model;
        try {
          return await withSameModelRetry({
            purpose: 'chat',
            maxAttempts: cfg.maxAttempts,
            run: async (attempt) => {
              const fail = hooks.failChat?.(attempt, ni);
              if (fail) throw fail;
              const lastUser = [...req.messages].reverse().find((m) => m.role === 'user');
              const text = lastUser?.content?.trim()
                ? `[mock:${req.purpose}] ${lastUser.content.slice(0, 200)}`
                : `[mock:${req.purpose}] empty`;
              return {
                text,
                usage: { promptTokens: 1, completionTokens: 1 },
                meta: {
                  provider: 'mock',
                  model,
                  attempt,
                  fallbackUsed: ni > 0,
                  latencyMs: Date.now() - started,
                },
              };
            },
          });
        } catch (err) {
          if (!(err instanceof GatewayError)) throw err;
          last = err;
          if (ni + 1 < nodes.length && canTryGenerateFallback(err)) continue;
          throw err;
        }
      }

      throw (
        last ??
        new GatewayError('exhausted', 'chat: no nodes', 'chat')
      );
    },

    async embed(texts: string[], model?: string): Promise<number[][]> {
      const m = resolveEmbedModel(cfg, model);
      return withSameModelRetry({
        purpose: 'embed',
        maxAttempts: cfg.maxAttempts,
        run: async (attempt) => {
          const fail = hooks.failEmbed?.(attempt);
          if (fail) throw fail;
          if (texts.length === 0) {
            throw new GatewayError('bad_request', 'embed: empty texts', 'embed', {
              attempt,
              model: m,
            });
          }
          return texts.map((t) => mockEmbedVector(t, cfg.embedDims));
        },
      });
    },

    async rerank(query: string, passages: string[], topN = 10, model?: string): Promise<RerankHit[]> {
      const m = resolveRerankModel(cfg, model);
      const endpoints = cfg.rerankEndpoints;
      let last: GatewayError | undefined;

      for (let ei = 0; ei < endpoints.length; ei++) {
        const ep = endpoints[ei]!;
        try {
          const hits = await withSameModelRetry({
            purpose: 'rerank',
            maxAttempts: cfg.maxAttempts,
            run: async (attempt) => {
              const fail = hooks.failRerank?.(attempt, ei);
              if (fail) throw fail;
              if (passages.length === 0) {
                throw new GatewayError('bad_request', 'rerank: empty passages', 'rerank', {
                  attempt,
                  model: m,
                });
              }
              const scored = passages
                .map((p, index) => ({ index, score: overlapScore(query, p) }))
                .sort((a, b) => b.score - a.score);
              return scored.slice(0, Math.min(topN, scored.length));
            },
          });
          recordRerankNodeUsed({ provider: ep, model: m, fallback: ei > 0 });
          return hits;
        } catch (err) {
          if (!(err instanceof GatewayError)) throw err;
          recordRerankAttemptFail(err.kind);
          last = err;
          // 换 endpoint 继续；链耗尽再抛
        }
      }

      throw (
        last ??
        new GatewayError('exhausted', 'rerank: no endpoints', 'rerank', { model: m })
      );
    },
  };
}
