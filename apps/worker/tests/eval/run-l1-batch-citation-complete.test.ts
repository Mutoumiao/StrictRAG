/**
 * 目标：worker L1 批跑必须与 api CLI 同口径落「引用完整率」，不得两条入口分叉。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §2 :81 · §6 :134
 * 被测：runL1Batch
 * 简介：注入 execute；只有 answerKind='knowledge' ∧ outcome='answered' 进分母，citations>0 才进分子；
 *       分母 0 → 率 null（该门不适用）。
 */

import { describe, expect, it } from 'vitest';

import { runL1Batch } from '../../src/eval/run-l1-batch.js';

describe('runL1Batch 引用完整率', () => {
  it('knowledge ∧ answered：有 citation 计完整，空 citations 计不完整', async () => {
    const report = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'mock',
      cases: [
        { caseKey: 'k1', question: 'q1', type: 'answerable' },
        { caseKey: 'k2', question: 'q2', type: 'answerable' },
      ],
      execute: async ({ caseKey }) =>
        caseKey === 'k1'
          ? { outcome: 'answered', reason: 'verified', answerKind: 'knowledge', citationCount: 2 }
          : { outcome: 'answered', reason: 'verified', answerKind: 'knowledge', citationCount: 0 },
    });

    expect(report.citationComplete).toBe(0.5);
    expect(report.citationCompleteDen).toBe(2);
    expect(report.cases[0]?.answerKind).toBe('knowledge');
    expect(report.cases[0]?.citationCount).toBe(2);
    expect(report.cases[1]?.citationCount).toBe(0);
  });

  it('只有 chitchat / 拒答 → 分母 0 → 率 null（该门不适用）', async () => {
    const report = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'mock',
      cases: [
        { caseKey: 'c1', question: 'q1', type: 'answerable' },
        { caseKey: 'u1', question: 'q2', type: 'unanswerable' },
      ],
      execute: async ({ caseKey }) =>
        caseKey === 'c1'
          ? { outcome: 'answered', reason: 'chitchat', answerKind: 'chitchat', citationCount: 0 }
          : { outcome: 'abstained', reason: 'unsupported_claims', citationCount: 0 },
    });

    expect(report.citationComplete).toBeNull();
    expect(report.citationCompleteDen).toBe(0);
    expect(report.cases[1]?.answerKind).toBeUndefined();
  });
});
