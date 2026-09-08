/**
 * 目标：worker L1 批跑必须串行入 2×2，error 出格，mock 不得 signoffEligible。
 * 需求：prds/08-quality §2 · 功能表 §5.2 · 覆盖 C4 · 覆盖 C2 · 覆盖 C3
 * 被测：runL1Batch
 * 简介：注入 execute；有 expectedDocIds 计 Hit@k；有 minSupport 计 tauStar；注入校准打分器计 judgeAuroc；≠ 签字 PASS。
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
    expect(report.tauStar).toBeNull();
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

  it('有 expectedDocIds 按 evidenceDocIds 计 Hit@k；无名单不计分', async () => {
    const report = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'mock',
      cases: [
        { caseKey: 'h', question: 'h', type: 'answerable', expectedDocIds: ['doc-a'] },
        { caseKey: 'm', question: 'm', type: 'answerable', expectedDocIds: ['doc-a'] },
        { caseKey: 'n', question: 'n', type: 'unanswerable' },
      ],
      execute: async ({ caseKey }) => {
        if (caseKey === 'h') return { outcome: 'answered', evidenceDocIds: ['doc-a'] };
        if (caseKey === 'm') return { outcome: 'answered', evidenceDocIds: ['doc-z'] };
        return { outcome: 'abstained' };
      },
    });
    expect(report.matrix).toEqual({ A: 2, B: 0, C: 0, D: 1 });
    expect(report.hitAtK).toBe(0.5);
    expect(report.hitAtKHits).toBe(1);
    expect(report.hitAtKScored).toBe(2);
    expect(report.signoffEligible).toBe(false);
    expect(report.cases[0]?.hitAtK).toBe(true);
    expect(report.cases[1]?.hitAtK).toBe(false);
    expect(report.cases[2]?.hitAtK).toBeNull();
  });

  it('有 minSupport 时离线扫网格写 tauStar；本跑 2×2 仍按真实 outcome', async () => {
    const report = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'mock',
      cases: [
        { caseKey: 'a-high', question: 'ah', type: 'answerable' },
        { caseKey: 'a-low', question: 'al', type: 'answerable' },
        { caseKey: 'u1', question: 'u1', type: 'unanswerable' },
        { caseKey: 'u2', question: 'u2', type: 'unanswerable' },
      ],
      execute: async ({ caseKey }) => {
        if (caseKey === 'a-high') return { outcome: 'answered', minSupport: 0.8 };
        if (caseKey === 'a-low') return { outcome: 'abstained', minSupport: 0.4 };
        return { outcome: 'abstained', minSupport: 0.2 };
      },
    });
    expect(report.matrix).toEqual({ A: 1, B: 1, C: 0, D: 2 });
    expect(report.tauStar).toBe(0.8);
    expect(report.signoffEligible).toBe(false);
  });

  it('注入校准打分器写 judgeAuroc；不注入则 null', async () => {
    const scored = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'mock',
      cases: [
        { caseKey: 'a1', question: 'q', type: 'answerable' },
        { caseKey: 'u1', question: 'u', type: 'unanswerable' },
      ],
      execute: async () => ({ outcome: 'abstained' }),
      judgeCalibCases: [
        { id: 'p', claim: 'c1', evidence: 'e1', label: 1 },
        { id: 'n', claim: 'c2', evidence: 'e2', label: 0 },
      ],
      scoreJudge: async () => [0.9, 0.1],
    });
    expect(scored.judgeAuroc).toBe(1);
    expect(scored.judgeAurocScored).toBe(2);
    expect(scored.signoffEligible).toBe(false);

    const unlabeled = await runL1Batch({
      kbId: 'k',
      retrieveMode: 'mock',
      cases: [{ caseKey: 'a1', question: 'q', type: 'answerable' }],
      execute: async () => ({ outcome: 'abstained' }),
    });
    expect(unlabeled.judgeAuroc).toBeNull();
    expect(unlabeled.judgeAurocScored).toBe(0);
  });

  it('打分数组短于校准题 → 抛错，不得用子集写成 1', async () => {
    await expect(
      runL1Batch({
        kbId: 'k',
        retrieveMode: 'mock',
        cases: [{ caseKey: 'a1', question: 'q', type: 'answerable' }],
        execute: async () => ({ outcome: 'abstained' }),
        judgeCalibCases: [
          { id: 'p1', claim: 'c1', evidence: 'e1', label: 1 },
          { id: 'p2', claim: 'c2', evidence: 'e2', label: 1 },
          { id: 'n1', claim: 'c3', evidence: 'e3', label: 0 },
          { id: 'n2', claim: 'c4', evidence: 'e4', label: 0 },
        ],
        scoreJudge: async () => [0.99, 0.98, 0.01],
      }),
    ).rejects.toThrow(/scoreJudge length/);
  });
});
