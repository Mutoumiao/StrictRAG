/**
 * 目标：ask/llm/rerank 指标必须可按标签聚合（含 llm 的 fallback 维与 rerank 的 node 维）。
 * 需求：ARCH-P2-4 · 功能表 §10.3「指标骨架（含 fallback 与 node_used）」
 * 被测：recordAskResult / recordLlmCall / recordRerank / recordRerankNodeUsed / recordRerankAttemptFail / metricGet
 * 简介：按标签聚合 ask / llm / rerank 计数（含 plane=ask）；llm 的 fallback 取真值且失败时记 unknown；rerank 按端点记 node。
 */

import { describe, expect, it } from 'vitest';

import {
  metricGet,
  recordAskResult,
  recordLlmCall,
  recordRerank,
  recordRerankAttemptFail,
  recordRerankNodeUsed,
} from '../../src/obs/index.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

describe('metrics skeleton', () => {
  it('ask_total / llm_call / rerank 可聚合', () => {
    recordAskResult({ status: 'answered', reason: 'verified', ok: true });
    recordAskResult({ status: 'abstained', reason: 'low_retrieval', ok: false });
    recordLlmCall('generate', true, false);
    recordLlmCall('judge', false);
    recordRerank(true);
    recordRerank(false, 'timeout');

    expect(metricGet('ask_total', { status: 'answered', reason: 'verified', plane: 'ask' })).toBe(
      1,
    );
    expect(metricGet('ask_fail', { reason: 'low_retrieval', plane: 'ask' })).toBe(1);
    expect(
      metricGet('llm_call_total', {
        purpose: 'generate',
        ok: 'true',
        fallback: 'false',
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('llm_call_total', { purpose: 'judge', ok: 'false', fallback: 'unknown', plane: 'ask' }),
    ).toBe(1);
    expect(metricGet('rerank_total', { ok: 'true', plane: 'ask' })).toBe(1);
    expect(metricGet('rerank_total', { ok: 'false', kind: 'timeout', plane: 'ask' })).toBe(1);
  });

  it('llm fallback 维只认显式 true；未给值记 unknown 而不是 false', () => {
    recordLlmCall('generate', true, true);
    recordLlmCall('generate', true, false);

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
    ).toBe(1);
    // 不得把「不知道」并进 false
    expect(
      metricGet('llm_call_total', {
        purpose: 'generate',
        ok: 'true',
        fallback: 'false',
        plane: 'ask',
      }),
    ).not.toBe(2);
  });

  it('rerank node / fallback / fail 三维按端点聚合', () => {
    recordRerankNodeUsed({ provider: 'http://gw-a/v1', model: 'bge-reranker', fallback: false });
    recordRerankNodeUsed({ provider: 'http://gw-b/v1', model: 'bge-reranker', fallback: true });
    recordRerankAttemptFail('provider_5xx');

    expect(
      metricGet('rerank_node_used', {
        provider: 'http://gw-a/v1',
        model: 'bge-reranker',
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('rerank_node_used', {
        provider: 'http://gw-b/v1',
        model: 'bge-reranker',
        plane: 'ask',
      }),
    ).toBe(1);
    // 只有非首选端点顶上才算 fallback
    expect(
      metricGet('rerank_fallback_used_total', {
        provider: 'http://gw-b/v1',
        model: 'bge-reranker',
        plane: 'ask',
      }),
    ).toBe(1);
    expect(
      metricGet('rerank_fallback_used_total', {
        provider: 'http://gw-a/v1',
        model: 'bge-reranker',
        plane: 'ask',
      }),
    ).toBe(0);
    expect(metricGet('rerank_fail_total', { kind: 'provider_5xx', plane: 'ask' })).toBe(1);
  });
});
