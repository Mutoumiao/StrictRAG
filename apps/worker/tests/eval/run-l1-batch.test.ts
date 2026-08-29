/**
 * 目标：worker L1 批跑必须串行入 2×2，error 出格，mock 不得 signoffEligible。
 * 需求：prds/08-quality §2 · 功能表 §5.2
 * 被测：runL1Batch
 * 简介：注入 execute；≠ 业务签字 PASS。
 */

import { describe, expect, it } from 'vitest';

import { runL1Batch } from '../../src/eval/run-l1-batch.js';

describe('runL1Batch', () => {
  it('可答 answered + 不可答 abstained → A 与 D；覆盖 1', async () => {
    const report = await runL1Batch({
      kbId: '01900000-0000-7000-8000-0000000000aa',
      retrieveMode: 'mock',
      now: () => new Date('2026-08-29T04:00:00.000Z'),
      cases: [
        { caseKey: 'a1', question: '可答题', type: 'answerable' },
        { caseKey: 'u1', question: '不可答', type: 'unanswerable' },
      ],
      execute: async ({ caseKey }) =>
        caseKey === 'a1' ? { outcome: 'answered' } : { outcome: 'abstained' },
    });
    expect(report.matrix).toEqual({ A: 1, B: 0, C: 0, D: 1 });
    expect(report.coverage).toBe(1);
    expect(report.errorCount).toBe(0);
    expect(report.signoffEligible).toBe(false);
    expect(report.cases[0].cell).toBe('A');
  });

  it('execute throw 记 error 且不进格', async () => {
    const report = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'live',
      cases: [{ caseKey: 'a1', question: 'q', type: 'answerable' }],
      execute: async () => {
        throw new Error('gateway down');
      },
    });
    expect(report.matrix).toEqual({ A: 0, B: 0, C: 0, D: 0 });
    expect(report.errorCount).toBe(1);
    expect(report.coverage).toBeNull();
    expect(report.signoffEligible).toBe(false);
    expect(report.cases[0].outcome).toBe('error');
  });
});
