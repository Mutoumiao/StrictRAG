import { describe, expect, it } from 'vitest';

import {
  GatewayError,
  applyBindingsToGatewayConfig,
  buildGatewayConfig,
  createHttpGateway,
  createMockGateway,
  mapGatewayFailureToAskReason,
  resolveChatModel,
  withSameModelRetry,
} from './index.js';

const baseCfg = buildGatewayConfig({
  APP_ENV: 'test',
  GATEWAY_MODE: 'mock',
  GATEWAY_BASE_URL: '',
  GATEWAY_API_KEY: '',
  RERANK_MIN_NODES: 1,
  GATEWAY_MAX_ATTEMPTS: 2,
  GATEWAY_EMBED_DIMS: 4,
});

describe('buildGatewayConfig', () => {
  it('mock when no base url', () => {
    const cfg = buildGatewayConfig({
      APP_ENV: 'development',
      GATEWAY_BASE_URL: '',
      GATEWAY_API_KEY: '',
    });
    expect(cfg.mode).toBe('mock');
    expect(cfg.bindingSource).toBe('env');
    expect(cfg.rerankEndpoints.length).toBeGreaterThanOrEqual(1);
  });

  it('staging defaults RERANK_MIN_NODES=2 and rejects single endpoint in http', () => {
    expect(() =>
      buildGatewayConfig({
        APP_ENV: 'staging',
        GATEWAY_MODE: 'http',
        GATEWAY_BASE_URL: 'http://gw.local/v1',
        GATEWAY_API_KEY: 'k',
      }),
    ).toThrow(/RERANK_MIN_NODES/);
  });

  it('staging accepts primary + fallback', () => {
    const cfg = buildGatewayConfig({
      APP_ENV: 'staging',
      GATEWAY_MODE: 'http',
      GATEWAY_BASE_URL: 'http://gw.local/v1',
      GATEWAY_API_KEY: 'k',
      GATEWAY_RERANK_FALLBACK_URL: 'http://gw-b.local/v1',
    });
    expect(cfg.rerankEndpoints).toHaveLength(2);
    expect(cfg.rerankMinNodes).toBe(2);
  });
});

describe('applyBindingsToGatewayConfig (B3-W)', () => {
  const providerId = '01900000-0000-7000-8000-0000000000aa';
  const providers = [
    {
      id: providerId,
      baseUrl: 'http://db-gw.local/v1',
      apiKeyEnc: 'secret-from-db',
      enabled: 1,
      timeoutMs: 30_000,
      modelsJson: [
        { name: 'db-chat', type: 'llm', enabled: true },
        { name: 'db-embed', type: 'embedding', enabled: true, dimensions: 16 },
        { name: 'db-rerank', type: 'rerank', enabled: true },
      ],
    },
  ];

  it('platform bindings override models and mark mixed', () => {
    const envCfg = buildGatewayConfig({
      APP_ENV: 'test',
      GATEWAY_MODE: 'http',
      GATEWAY_BASE_URL: 'http://env.local/v1',
      GATEWAY_API_KEY: 'env-key',
      GATEWAY_CHAT_MODEL: 'env-chat',
      RERANK_MIN_NODES: 1,
    });
    const cfg = applyBindingsToGatewayConfig(envCfg, {
      providers,
      bindings: [
        { purpose: 'generate', primaryRef: `${providerId}#db-chat` },
        { purpose: 'embed', primaryRef: `${providerId}#db-embed` },
        { purpose: 'rerank', primaryRef: `${providerId}#db-rerank` },
      ],
    });
    expect(cfg.bindingSource).toBe('mixed');
    expect(cfg.models.chat).toBe('db-chat');
    expect(cfg.models.embed).toBe('db-embed');
    expect(resolveChatModel(cfg, 'generate')).toBe('db-chat');
    expect(cfg.purposeEndpoints?.chat?.baseUrl).toBe('http://db-gw.local/v1');
    expect(cfg.purposeEndpoints?.chat?.apiKey).toBe('secret-from-db');
  });

  it('empty bindings → env fallback', () => {
    const envCfg = buildGatewayConfig({
      APP_ENV: 'test',
      GATEWAY_BASE_URL: '',
      GATEWAY_API_KEY: '',
      RERANK_MIN_NODES: 1,
    });
    const cfg = applyBindingsToGatewayConfig(envCfg, { providers, bindings: [] });
    expect(cfg.bindingSource).toBe('env');
    expect(cfg.models.chat).toBe(envCfg.models.chat);
  });
});

describe('withSameModelRetry', () => {
  it('retries once on retryable then succeeds', async () => {
    let n = 0;
    const result = await withSameModelRetry({
      purpose: 'chat',
      maxAttempts: 2,
      run: async (attempt) => {
        n += 1;
        if (attempt === 1) {
          throw new GatewayError('provider_5xx', 'boom', 'chat', { attempt, status: 503 });
        }
        return 'ok';
      },
    });
    expect(result).toBe('ok');
    expect(n).toBe(2);
  });

  it('does not retry auth', async () => {
    let n = 0;
    await expect(
      withSameModelRetry({
        purpose: 'chat',
        maxAttempts: 2,
        run: async () => {
          n += 1;
          throw new GatewayError('auth', 'nope', 'chat', { status: 401 });
        },
      }),
    ).rejects.toMatchObject({ kind: 'auth' });
    expect(n).toBe(1);
  });

  it('exhausted after maxAttempts retryable failures', async () => {
    await expect(
      withSameModelRetry({
        purpose: 'embed',
        maxAttempts: 2,
        run: async (attempt) => {
          throw new GatewayError('timeout', 'slow', 'embed', { attempt });
        },
      }),
    ).rejects.toMatchObject({ kind: 'exhausted', purpose: 'embed' });
  });
});

describe('mock gateway chat/embed/rerank', () => {
  it('chat embed rerank happy path', async () => {
    const gw = createMockGateway(baseCfg);
    const chat = await gw.chat({
      purpose: 'generate',
      messages: [{ role: 'user', content: 'hello policy' }],
    });
    expect(chat.text).toContain('hello policy');
    expect(chat.meta.attempt).toBe(1);

    const vectors = await gw.embed(['a', 'b']);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(4);

    const ranked = await gw.rerank('policy leave', ['unrelated', 'policy for leave days'], 2);
    expect(ranked[0]!.index).toBe(1);
  });

  it('chat full chain fail → exhausted → map internal_guard (not answered)', async () => {
    const gw = createMockGateway(baseCfg, {
      failChat: () => new GatewayError('provider_5xx', 'down', 'chat', { status: 500 }),
    });
    let err: GatewayError | undefined;
    try {
      await gw.chat({ purpose: 'generate', messages: [{ role: 'user', content: 'x' }] });
    } catch (e) {
      err = e as GatewayError;
    }
    expect(err).toBeInstanceOf(GatewayError);
    expect(err!.kind).toBe('exhausted');
    expect(mapGatewayFailureToAskReason(err!, 'chat')).toBe('internal_guard');
  });

  it('rerank full chain fail → map rerank_unavailable (no silent answered)', async () => {
    const cfg = buildGatewayConfig({
      APP_ENV: 'test',
      GATEWAY_MODE: 'mock',
      GATEWAY_BASE_URL: '',
      GATEWAY_API_KEY: '',
      RERANK_MIN_NODES: 2,
      GATEWAY_MAX_ATTEMPTS: 2,
    });
    expect(cfg.rerankEndpoints).toHaveLength(2);
    const gw = createMockGateway(cfg, {
      failRerank: () => new GatewayError('provider_5xx', 'rerank down', 'rerank', { status: 503 }),
    });
    let err: GatewayError | undefined;
    try {
      await gw.rerank('q', ['p1', 'p2'], 2);
    } catch (e) {
      err = e as GatewayError;
    }
    expect(err).toBeInstanceOf(GatewayError);
    // 链上两节点各耗尽同模型重试后抛出
    expect(['exhausted', 'provider_5xx']).toContain(err!.kind);
    expect(mapGatewayFailureToAskReason(err!, 'rerank')).toBe('rerank_unavailable');
  });

  it('embed fail maps low_retrieval', async () => {
    const gw = createMockGateway(baseCfg, {
      failEmbed: () => new GatewayError('timeout', 'embed slow', 'embed'),
    });
    try {
      await gw.embed(['x']);
      expect.fail('should throw');
    } catch (e) {
      expect(mapGatewayFailureToAskReason(e as GatewayError, 'embed')).toBe('low_retrieval');
    }
  });
});

describe('http gateway retry with inject fetch', () => {
  it('retries 503 then succeeds', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      if (calls === 1) {
        return new Response('busy', { status: 503 });
      }
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: 'hello' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    };

    const cfg = buildGatewayConfig({
      APP_ENV: 'development',
      GATEWAY_MODE: 'http',
      GATEWAY_BASE_URL: 'http://gw.test/v1',
      GATEWAY_API_KEY: 'k',
      RERANK_MIN_NODES: 1,
      GATEWAY_MAX_ATTEMPTS: 2,
    });
    const gw = createHttpGateway({ cfg, fetchImpl });
    const r = await gw.chat({
      purpose: 'generate',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.text).toBe('hello');
    expect(calls).toBe(2);
    expect(r.meta.attempt).toBe(2);
  });

  it('rerank 5xx all nodes → error mappable to rerank_unavailable', async () => {
    const fetchImpl: typeof fetch = async () => new Response('no', { status: 503 });
    const cfg = buildGatewayConfig({
      APP_ENV: 'development',
      GATEWAY_MODE: 'http',
      GATEWAY_BASE_URL: 'http://gw-a/v1',
      GATEWAY_API_KEY: 'k',
      GATEWAY_RERANK_FALLBACK_URL: 'http://gw-b/v1',
      RERANK_MIN_NODES: 2,
      GATEWAY_MAX_ATTEMPTS: 2,
    });
    const gw = createHttpGateway({ cfg, fetchImpl });
    try {
      await gw.rerank('q', ['a'], 1);
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(GatewayError);
      expect(mapGatewayFailureToAskReason(e as GatewayError, 'rerank')).toBe('rerank_unavailable');
    }
  });
});
