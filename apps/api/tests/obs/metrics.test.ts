/**
 * 目标：ask/llm/rerank 指标必须可按标签聚合。
 * 需求：ARCH-P2-4
 * 被测：recordAskResult / recordLlmCall / recordRerank / metricGet
 * 简介：按标签聚合 ask / llm / rerank 计数。
 */

import { describe, expect, it } from 'vitest';

import {
  metricGet,
  recordAskResult,
  recordLlmCall,
  recordRerank,
} from '../../src/obs/index.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

describe('metrics skeleton', () => {
  it('ask_total / llm_call / rerank 可聚合', () => {
    recordAskResult({ status: 'answered', reason: 'verified', ok: true });
    recordAskResult({ status: 'abstained', reason: 'low_retrieval', ok: false });
    recordLlmCall('generate', true);
    recordLlmCall('judge', false);
    recordRerank(true);
    recordRerank(false, 'timeout');

    expect(metricGet('ask_total', { status: 'answered', reason: 'verified' })).toBe(1);
    expect(metricGet('ask_fail', { reason: 'low_retrieval' })).toBe(1);
    expect(metricGet('llm_call_total', { purpose: 'generate', ok: 'true' })).toBe(1);
    expect(metricGet('llm_call_total', { purpose: 'judge', ok: 'false' })).toBe(1);
    expect(metricGet('rerank_total', { ok: 'true' })).toBe(1);
    expect(metricGet('rerank_total', { ok: 'false', kind: 'timeout' })).toBe(1);
  });
});
