/**
 * 目标：worker L2 批跑必须串行多轮窗，泄漏计零容忍，mock 不得 signoffEligible。
 * 需求：prds/08-quality §6.2 · 功能表 §10.2
 * 被测：runL2Batch
 * 简介：注入 executeTurn；≠ 准出 PASS。
 */

import { describe, expect, it } from 'vitest';

import { L2_TYPES, type L2Case, type L2Type } from '@strict-rag/contracts';

import { runL2Batch } from '../../src/eval/run-l2-batch.js';

function l2Case(id: string, type: L2Type, extra?: Partial<L2Case>): L2Case {
  return {
    id,
    type,
    turns: [
      { role: 'user', text: '住宿？', session: 'same' },
      { role: 'user', text: '那餐补呢', session: 'same' },
    ],
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: false,
      accept: ['answered'],
    },
    rubric: 'r',
    ...extra,
  };
}

describe('runL2Batch', () => {
  it('mock 即使零泄漏也不得 signoffEligible', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'mock',
      cases: [l2Case('l2-a-001', 'near_coref')],
      executeTurn: async () => ({
        outcome: 'answered',
        rewriteUsed: false,
        evidenceTexts: ['条款'],
        answer: 'ok',
      }),
    });
    expect(report.passCount).toBe(1);
    expect(report.signoffEligible).toBe(false);
  });

  it('history leak increments zeroToleranceHits and fails the case', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-b-001', 'near_coref')],
      executeTurn: async ({ question }) => ({
        outcome: 'answered',
        rewriteUsed: false,
        evidenceTexts: question.includes('餐补') ? ['住宿？'] : [],
        answer: 'ok',
      }),
    });
    expect(report.zeroToleranceHits).toBe(1);
    expect(report.cases[0]?.verdict).toBe('fail');
    expect(report.signoffEligible).toBe(false);
  });

  it('live + 九类齐 + ≥15 + 零泄漏 → 工程 signoffEligible', async () => {
    const cases = L2_TYPES.map((type, i) => l2Case(`l2-t-${String(i).padStart(3, '0')}`, type));
    while (cases.length < 15) {
      cases.push(l2Case(`l2-x-${String(cases.length).padStart(3, '0')}`, 'near_coref'));
    }
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases,
      executeTurn: async () => ({
        outcome: 'answered',
        rewriteUsed: false,
        evidenceTexts: ['条款'],
        answer: 'ok',
      }),
    });
    expect(report.caseCount).toBeGreaterThanOrEqual(15);
    expect(report.zeroToleranceHits).toBe(0);
    expect(report.signoffEligible).toBe(true);
  });
});
