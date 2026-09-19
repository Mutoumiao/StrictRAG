/**
 * 目标：generate 绑定全链（primary + 备用）都失败时，走图必须拒答 internal_guard，禁止 knowledge 胡答。
 * 需求：剧本 H5 · P2必签 · prds/07-models · ADR-055
 * 被测：runAskGraph · chatFromGateway · applyBindingsToGatewayConfig（generate 链）· createMockGateway failChat
 * 简介：mock 网关两节点都 5xx → 图在 generate 步拒答；有证据也不得 answered，且不再进 verify。
 */

import { describe, expect, it } from 'vitest';

import { chatFromGateway } from '../../src/graph/run.js';
import {
  GatewayError,
  applyBindingsToGatewayConfig,
  buildGatewayConfig,
  createMockGateway,
} from '../../src/services/gateway/index.js';
import { baseInput, deps, runAskGraph } from './_support/graph-harness.js';

const PRIMARY = '01900000-0000-7000-8000-0000000000aa';
const FALLBACK = '01900000-0000-7000-8000-0000000000bb';

const providers = [
  {
    id: PRIMARY,
    baseUrl: 'http://chat-primary.local/v1',
    apiKeyEnc: 'pk',
    enabled: 1,
    timeoutMs: 30_000,
    modelsJson: [{ name: 'chat-a', type: 'llm', enabled: true }],
  },
  {
    id: FALLBACK,
    baseUrl: 'http://chat-fallback.local/v1',
    apiKeyEnc: 'fk',
    enabled: 1,
    timeoutMs: 30_000,
    modelsJson: [{ name: 'chat-b', type: 'llm', enabled: true }],
  },
];

/** generate 已配 primary + 备用（P4 opt-in 切链），两条腿都不可达 */
function cfgWithGenerateChain() {
  const envCfg = buildGatewayConfig({
    APP_ENV: 'test',
    GATEWAY_MODE: 'mock',
    GATEWAY_BASE_URL: '',
    GATEWAY_API_KEY: '',
    RERANK_MIN_NODES: 1,
    GATEWAY_MAX_ATTEMPTS: 1,
  });
  return applyBindingsToGatewayConfig(envCfg, {
    providers,
    bindings: [
      {
        purpose: 'generate',
        primaryRef: `${PRIMARY}#chat-a`,
        fallbackRefs: [`${FALLBACK}#chat-b`],
      },
    ],
  });
}

describe('generate 全链失败走图（H5）', () => {
  it('primary 与备用都失败 → abstained internal_guard，无 knowledge 胡答', async () => {
    const triedNodes: number[] = [];
    const gw = createMockGateway(cfgWithGenerateChain(), {
      failChat: (_attempt, nodeIndex) => {
        triedNodes.push(nodeIndex ?? -1);
        return new GatewayError('provider_5xx', 'chat chain down', 'chat', { status: 500 });
      },
    });

    const r = await runAskGraph(baseInput(), deps({ chat: chatFromGateway(gw) }));

    // 全链：primary + 备用都试过，不是只打一个节点
    expect(triedNodes).toEqual([0, 1]);
    expect(r.status).toBe('abstained');
    expect(r.reason).toBe('internal_guard');
    expect(r.answer).toBe('');
    expect(r.answerKind).not.toBe('knowledge');
    expect(r.citations).toEqual([]);
    // 检索本身有证据（1 条），仍不得据此胡答
    expect(r.debug?.evidenceCount).toBe(1);
    // generate 失败即终态：不得继续 claim_split / judge
    expect(r.debug?.llmCalls).toBe(1);
  });
});
