/**
 * 目标：校准集规模常量与打分器来源三态必须单一来源（contracts 导出，api / worker 引用），
 *       且 mock 伪打分器确定性、只可打印不可进判定。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §4（校准集 ≥100 条）· §6.1（mock 数字禁进签字包）· ADR-061
 * 被测：JUDGE_CALIB_MIN_CASES · JUDGE_CALIB_SCORER_MODES · JUDGE_AUROC_SOURCES · judgeAurocSourceFor · mockJudgeScorer
 * 简介：规模 = 100（PRD §4 原文数字）；三态映射 fail-closed；mock 打分器同输入同输出且得分与 label 同源。
 */

import { describe, expect, it } from 'vitest';

import {
  JUDGE_AUROC_SOURCES,
  JUDGE_CALIB_MIN_CASES,
  JUDGE_CALIB_SCORER_MODES,
  judgeAurocSourceFor,
  mockJudgeScorer,
  type JudgeCalibCase,
} from '../../src/eval/l1-matrix.js';

function calib(pos: number, neg: number): JudgeCalibCase[] {
  return [
    ...Array.from({ length: pos }, (_, i) => ({
      id: `p${i}`,
      claim: `c${i}`,
      evidence: `e${i}`,
      label: 1 as const,
    })),
    ...Array.from({ length: neg }, (_, i) => ({
      id: `n${i}`,
      claim: `c${i}`,
      evidence: `e${i}`,
      label: 0 as const,
    })),
  ];
}

describe('Judge 校准集规模常量', () => {
  it('= 100（PRD §4 写死的 ≥100 条；判定处只读本常量）', () => {
    expect(JUDGE_CALIB_MIN_CASES).toBe(100);
  });
});

describe('打分器来源声明 → 报告三态', () => {
  it('off / mock / http 三取值，未声明与脏值 fail-closed 落 none', () => {
    expect([...JUDGE_CALIB_SCORER_MODES]).toEqual(['off', 'mock', 'http']);
    expect(judgeAurocSourceFor('off')).toBe('none');
    expect(judgeAurocSourceFor('mock')).toBe('mock');
    expect(judgeAurocSourceFor('http')).toBe('live');
    expect(judgeAurocSourceFor(undefined)).toBe('none');
    expect(judgeAurocSourceFor('HTTP')).toBe('none');
    expect(judgeAurocSourceFor('live')).toBe('none');
  });

  it('报告三态只有 live / mock / none 三种，且只有 http 映射成 live', () => {
    expect([...JUDGE_AUROC_SOURCES]).toEqual(['live', 'mock', 'none']);
    expect(JUDGE_CALIB_SCORER_MODES.map((m) => judgeAurocSourceFor(m))).toEqual([
      'none',
      'mock',
      'live',
    ]);
  });
});

describe('mockJudgeScorer（确定性伪打分器）', () => {
  it('同输入同输出；与题数无关；得分与 label 同源（支持 0.9 / 不支持 0.1）', () => {
    const cases = calib(3, 2);
    expect(mockJudgeScorer(cases)).toEqual([0.9, 0.9, 0.9, 0.1, 0.1]);
    expect(mockJudgeScorer(cases)).toEqual(mockJudgeScorer(cases));
    expect(mockJudgeScorer([])).toEqual([]);
  });

  it('产出恒为合法分数空间（0..1）——可打印，但来源标记才是它不能进判定的原因', () => {
    for (const score of mockJudgeScorer(calib(1, 1))) {
      expect(score).not.toBeNull();
      expect(score as number).toBeGreaterThanOrEqual(0);
      expect(score as number).toBeLessThanOrEqual(1);
    }
  });
});
