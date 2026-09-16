/**
 * 目标：fallback 与 rerank 节点真值必须从 Gateway 流到指标标签（不得由 api 侧猜）。
 * 需求：功能表 §10.3 指标骨架「含 fallback 与 node_used」· prds/07-models §5.1.1
 * 被测：chatFromGateway · createMockGateway（rerank 端点链）
 * 简介：chat 的 meta.fallbackUsed 进 llm_call_total 的 fallback 维（失败记 unknown）；rerank 换端点后记 node 与 fallback。
 */

import { describe, expect, it } from 'vitest';

import { chatFromGateway } from '../../src/graph/index.js';
import { metricGet } from '../../src/obs/index.js';
import {
  buildGatewayConfig,
  createMockGateway,
  GatewayError,
  type GatewayClient,
} from '../../src/services/gateway/index.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

const MODEL = 'bge-reranker-v2-m3';

function mockCfgWithTwoRerankNodes() {
  return buildGatewayConfig({
    APP_ENV: 'test',
    GATEWAY_MODE: 'mock',
    GATEWAY_BASE_URL: '',
    GATEWAY_API_KEY: '',
    RERANK_MIN_NODES: 2,
    GATEWAY_RERANK_MODEL: MODEL,
  });
}

function fakeGateway(chat: GatewayClient['chat']): GatewayClient {
  return {
    chat,
    embed: async () => [],
    rerank: async () => [],
  };
}

describe('llm_call_total fallback 维（真值来自 Gateway）', () => {
  it('切到备用节点时 fallback=true', async () => {
    const chat = chatFromGateway(
      fakeGateway(async () => ({
        text: 'ok',
        meta: { provider: 'p', model: 'm', attempt: 2, fallbackUsed: true, latencyMs: 3 },
      })),
    );
    await chat('generate', [{ role: 'user', content: 'q' }]);

    expect(
      metricGet('llm_call_total', {
        purpose: 'generate',
        ok: 'true',
        fallback: 'true',
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('llm_call_total', {
        purpose: 'generate',
        ok: 'true',
        fallback: 'false',
        plane: 'ask',
      }),
    ).toBe(0);
  });

  it('主节点直答时 fallback=false', async () => {
    const chat = chatFromGateway(
      fakeGateway(async () => ({
        text: 'ok',
        meta: { provider: 'p', model: 'm', attempt: 1, fallbackUsed: false, latencyMs: 3 },
      })),
    );
    await chat('judge', [{ role: 'user', content: 'q' }]);

    expect(
      metricGet('llm_call_total', {
        purpose: 'judge',
        ok: 'true',
        fallback: 'false',
        plane: 'ask',
      }),
    ).toBe(1);
  });

  it('调用失败拿不到 fallback 真值 → 记 unknown（不谎报 false），且 ok=false 照旧', async () => {
    const chat = chatFromGateway(
      fakeGateway(async () => {
        throw new GatewayError('timeout', 'slow', 'chat');
      }),
    );
    await expect(chat('generate', [{ role: 'user', content: 'q' }])).rejects.toBeInstanceOf(
      GatewayError,
    );

    expect(
      metricGet('llm_call_total', {
        purpose: 'generate',
        ok: 'false',
        fallback: 'unknown',
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('llm_call_total', {
        purpose: 'generate',
        ok: 'false',
        fallback: 'false',
        plane: 'ask',
      }),
    ).toBe(0);
  });
});

describe('rerank 端点链 node / fallback / fail 维', () => {
  it('首个端点失败换备用端点：node 记备用端点，fallback_used 记 1', async () => {
    const gw = createMockGateway(mockCfgWithTwoRerankNodes(), {
      failRerank: (_attempt, ei) =>
        ei === 0 ? new GatewayError('bad_request', 'endpoint down', 'rerank', { status: 400 }) : null,
    });

    const hits = await gw.rerank('年假', ['无关', '年假 15 天'], 2);
    expect(hits.length).toBeGreaterThan(0);

    expect(
      metricGet('rerank_node_used', {
        provider: 'mock://rerank-1',
        model: MODEL,
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('rerank_fallback_used_total', {
        provider: 'mock://rerank-1',
        model: MODEL,
        plane: 'ask',
      }),
    ).toBe(1);
    expect(metricGet('rerank_fail_total', { kind: 'bad_request', plane: 'ask' })).toBe(1);
    // 首选端点没被用过，不得记它的 node
    expect(
      metricGet('rerank_node_used', {
        provider: 'mock://rerank-0',
        model: MODEL,
        plane: 'ask',
      }),
    ).toBe(0);
  });

  it('首选端点直答：node 记首选，fallback_used 为 0', async () => {
    const gw = createMockGateway(mockCfgWithTwoRerankNodes(), {});

    await gw.rerank('年假', ['年假 15 天'], 1);

    expect(
      metricGet('rerank_node_used', {
        provider: 'mock://rerank-0',
        model: MODEL,
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('rerank_fallback_used_total', {
        provider: 'mock://rerank-0',
        model: MODEL,
        plane: 'ask',
      }),
    ).toBe(0);
    expect(metricGet('rerank_fail_total', { kind: 'bad_request', plane: 'ask' })).toBe(0);
  });
});
