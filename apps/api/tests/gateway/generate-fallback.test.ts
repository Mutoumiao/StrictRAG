/**
 * 目标：generate 绑定的 fallbacks 必须在运行时切链，不能只落库。
 * 需求：P4 多模型 fallback · B3-W · 工单 generate 多模型 fallback 最小闭环
 * 被测：applyBindingsToGatewayConfig / resolveChatNodes / mock+http chat / canTryGenerateFallback
 * 简介：opt-in 备用 ModelRef；无 fallbacks 行为不变；auth 不盲切；judge 不走 generate 链。
 */

import { describe, expect, it } from 'vitest';

import { mergeBindingRows } from '../../src/services/gateway/bindings.js';
import {
  GatewayError,
  applyBindingsToGatewayConfig,
  buildGatewayConfig,
  canTryGenerateFallback,
  createHttpGateway,
  createMockGateway,
  mapGatewayFailureToAskReason,
  resolveChatNodes,
} from '../../src/services/gateway/index.js';

const primaryId = '01900000-0000-7000-8000-0000000000aa';
const fallbackId = '01900000-0000-7000-8000-0000000000bb';

const twoProviders = [
  {
    id: primaryId,
    baseUrl: 'http://primary.local/v1',
    apiKeyEnc: 'pk',
    enabled: 1,
    timeoutMs: 30_000,
    modelsJson: [
      { name: 'chat-a', type: 'llm', enabled: true },
      { name: 'emb', type: 'embedding', enabled: true, dimensions: 8 },
    ],
  },
  {
    id: fallbackId,
    baseUrl: 'http://fallback.local/v1',
    apiKeyEnc: 'fk',
    enabled: 1,
    timeoutMs: 30_000,
    modelsJson: [
      { name: 'chat-b', type: 'llm', enabled: true },
      { name: 'chat-off', type: 'llm', enabled: false },
    ],
  },
];

function envHttp() {
  return buildGatewayConfig({
    APP_ENV: 'test',
    GATEWAY_MODE: 'http',
    GATEWAY_BASE_URL: 'http://env.local/v1',
    GATEWAY_API_KEY: 'env-key',
    GATEWAY_CHAT_MODEL: 'env-chat',
    RERANK_MIN_NODES: 1,
    GATEWAY_MAX_ATTEMPTS: 1,
  });
}

describe('canTryGenerateFallback', () => {
  it('exhausted / unavailable / retryable 可切；auth / bad_request / content_filter 不可切', () => {
    expect(
      canTryGenerateFallback(new GatewayError('exhausted', 'x', 'chat')),
    ).toBe(true);
    expect(
      canTryGenerateFallback(new GatewayError('unavailable', 'x', 'chat')),
    ).toBe(true);
    expect(
      canTryGenerateFallback(new GatewayError('provider_5xx', 'x', 'chat')),
    ).toBe(true);
    expect(canTryGenerateFallback(new GatewayError('auth', 'x', 'chat'))).toBe(false);
    expect(
      canTryGenerateFallback(new GatewayError('bad_request', 'x', 'chat')),
    ).toBe(false);
    expect(
      canTryGenerateFallback(new GatewayError('content_filter', 'x', 'chat')),
    ).toBe(false);
  });
});

describe('applyBindingsToGatewayConfig generate fallbacks', () => {
  it('无 fallbackRefs → 不写 generateFallbacks', () => {
    const cfg = applyBindingsToGatewayConfig(envHttp(), {
      providers: twoProviders,
      bindings: [{ purpose: 'generate', primaryRef: `${primaryId}#chat-a` }],
    });
    expect(cfg.generateFallbacks).toBeUndefined();
    expect(resolveChatNodes(cfg, 'generate')).toHaveLength(1);
    expect(resolveChatNodes(cfg, 'generate')[0]?.model).toBe('chat-a');
  });

  it('有效 llm 备用 → generateFallbacks 有节点', () => {
    const cfg = applyBindingsToGatewayConfig(envHttp(), {
      providers: twoProviders,
      bindings: [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [`${fallbackId}#chat-b`],
        },
      ],
    });
    expect(cfg.generateFallbacks).toEqual([
      { baseUrl: 'http://fallback.local/v1', apiKey: 'fk', model: 'chat-b' },
    ]);
    const nodes = resolveChatNodes(cfg, 'generate');
    expect(nodes).toHaveLength(2);
    expect(nodes[0]?.model).toBe('chat-a');
    expect(nodes[1]?.model).toBe('chat-b');
  });

  it('禁用 / 非 llm / 与 primary 重复的备用跳过', () => {
    const cfg = applyBindingsToGatewayConfig(envHttp(), {
      providers: twoProviders,
      bindings: [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [
            `${primaryId}#chat-a`,
            `${fallbackId}#chat-off`,
            `${primaryId}#emb`,
            'not-a-ref',
          ],
        },
      ],
    });
    expect(cfg.generateFallbacks).toBeUndefined();
  });

  it('KB 覆盖整行含 fallbackRefs', () => {
    const merged = mergeBindingRows(
      [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [`${fallbackId}#chat-b`],
        },
      ],
      [
        {
          purpose: 'generate',
          primaryRef: `${fallbackId}#chat-b`,
          fallbackRefs: [],
        },
      ],
    );
    expect(merged.find((b) => b.purpose === 'generate')).toEqual({
      purpose: 'generate',
      primaryRef: `${fallbackId}#chat-b`,
      fallbackRefs: [],
    });
  });

  it('再解析空绑定不得残留上一轮 generateFallbacks', () => {
    const withFb = applyBindingsToGatewayConfig(envHttp(), {
      providers: twoProviders,
      bindings: [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [`${fallbackId}#chat-b`],
        },
      ],
    });
    expect(withFb.generateFallbacks?.length).toBe(1);
    const cleared = applyBindingsToGatewayConfig(withFb, { providers: twoProviders, bindings: [] });
    expect(cleared.generateFallbacks).toBeUndefined();
    expect(cleared.bindingSource).toBe('env');

    const miss = applyBindingsToGatewayConfig(withFb, {
      providers: twoProviders,
      bindings: [{ purpose: 'generate', primaryRef: 'nope#x' }],
    });
    expect(miss.generateFallbacks).toBeUndefined();
  });

  it('judge 与 model 覆盖只有 primary', () => {
    const cfg = applyBindingsToGatewayConfig(envHttp(), {
      providers: twoProviders,
      bindings: [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [`${fallbackId}#chat-b`],
        },
      ],
    });
    expect(resolveChatNodes(cfg, 'judge')).toHaveLength(1);
    expect(resolveChatNodes(cfg, 'generate', 'forced-model')).toHaveLength(1);
    expect(resolveChatNodes(cfg, 'generate', 'forced-model')[0]?.model).toBe('forced-model');
  });
});

describe('mock generate fallback chat', () => {
  function cfgWithFallback() {
    const envCfg = buildGatewayConfig({
      APP_ENV: 'test',
      GATEWAY_MODE: 'mock',
      GATEWAY_BASE_URL: '',
      GATEWAY_API_KEY: '',
      RERANK_MIN_NODES: 1,
      GATEWAY_MAX_ATTEMPTS: 1,
    });
    return applyBindingsToGatewayConfig(envCfg, {
      providers: twoProviders,
      bindings: [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [`${fallbackId}#chat-b`],
        },
      ],
    });
  }

  it('primary 5xx 耗尽 → 备用成功且 fallbackUsed=true', async () => {
    const seen: number[] = [];
    const gw = createMockGateway(cfgWithFallback(), {
      failChat: (_attempt, nodeIndex) => {
        seen.push(nodeIndex ?? -1);
        if (nodeIndex === 0) {
          return new GatewayError('provider_5xx', 'primary down', 'chat', { status: 500 });
        }
        return null;
      },
    });
    const r = await gw.chat({
      purpose: 'generate',
      messages: [{ role: 'user', content: 'policy' }],
    });
    expect(r.meta.fallbackUsed).toBe(true);
    expect(r.meta.model).toBe('chat-b');
    expect(seen).toContain(0);
    expect(seen).toContain(1);
  });

  it('无备用时 primary 失败仍 exhausted', async () => {
    const envCfg = buildGatewayConfig({
      APP_ENV: 'test',
      GATEWAY_MODE: 'mock',
      GATEWAY_BASE_URL: '',
      GATEWAY_API_KEY: '',
      RERANK_MIN_NODES: 1,
      GATEWAY_MAX_ATTEMPTS: 1,
    });
    const gw = createMockGateway(envCfg, {
      failChat: () => new GatewayError('provider_5xx', 'down', 'chat', { status: 500 }),
    });
    await expect(
      gw.chat({ purpose: 'generate', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toMatchObject({ kind: 'exhausted' });
  });

  it('primary auth 即使有备用也不切', async () => {
    const nodes: number[] = [];
    const gw = createMockGateway(cfgWithFallback(), {
      failChat: (_attempt, nodeIndex) => {
        nodes.push(nodeIndex ?? -1);
        return new GatewayError('auth', 'nope', 'chat', { status: 401 });
      },
    });
    await expect(
      gw.chat({ purpose: 'generate', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toMatchObject({ kind: 'auth' });
    expect(nodes).toEqual([0]);
  });

  it('purpose=judge 不切 generate 备用', async () => {
    const seen: number[] = [];
    const gw = createMockGateway(cfgWithFallback(), {
      failChat: (_attempt, nodeIndex) => {
        seen.push(nodeIndex ?? -1);
        return new GatewayError('provider_5xx', 'down', 'chat', { status: 500 });
      },
    });
    await expect(
      gw.chat({ purpose: 'judge', messages: [{ role: 'user', content: 'x' }] }),
    ).rejects.toMatchObject({ kind: 'exhausted' });
    expect(seen).toEqual([0]);
  });

  it('全链失败 → exhausted → internal_guard', async () => {
    const gw = createMockGateway(cfgWithFallback(), {
      failChat: () => new GatewayError('provider_5xx', 'down', 'chat', { status: 500 }),
    });
    try {
      await gw.chat({ purpose: 'generate', messages: [{ role: 'user', content: 'x' }] });
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(GatewayError);
      expect((e as GatewayError).kind).toBe('exhausted');
      expect(mapGatewayFailureToAskReason(e as GatewayError, 'chat')).toBe('internal_guard');
    }
  });
});

describe('http generate fallback chat', () => {
  it('primary URL 503、备用 URL 200 → fallbackUsed=true', async () => {
    const envCfg = buildGatewayConfig({
      APP_ENV: 'development',
      GATEWAY_MODE: 'http',
      GATEWAY_BASE_URL: 'http://primary.local/v1',
      GATEWAY_API_KEY: 'pk',
      RERANK_MIN_NODES: 1,
      GATEWAY_MAX_ATTEMPTS: 1,
    });
    const cfg = applyBindingsToGatewayConfig(envCfg, {
      providers: twoProviders,
      bindings: [
        {
          purpose: 'generate',
          primaryRef: `${primaryId}#chat-a`,
          fallbackRefs: [`${fallbackId}#chat-b`],
        },
      ],
    });
    const seen: string[] = [];
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      seen.push(url);
      if (url.includes('fallback.local')) {
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: 'from-fallback' } }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('busy', { status: 503 });
    };
    const gw = createHttpGateway({ cfg, fetchImpl });
    const r = await gw.chat({
      purpose: 'generate',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.text).toBe('from-fallback');
    expect(r.meta.fallbackUsed).toBe(true);
    expect(r.meta.model).toBe('chat-b');
    expect(seen.some((u) => u.includes('primary.local'))).toBe(true);
    expect(seen.some((u) => u.includes('fallback.local'))).toBe(true);
  });
});
