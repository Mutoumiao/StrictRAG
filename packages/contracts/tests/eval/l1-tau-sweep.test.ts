/**
 * 目标：L1 必须能按 minSupport 离线扫 τ 网格得到 tau*，无分数不得因降 τ 变成 answered。
 * 需求：覆盖 C2 · prds/08-quality
 * 被测：cRate · parseMinSupport · outcomeAtTau · sweepTau
 * 简介：不改本跑 2×2 / signoffEligible；不是写 TAU_CLAIM。
 */

import { describe, expect, it } from 'vitest';

import {
  TAU_STAR_COVERAGE_MIN,
  TAU_STAR_C_RATE_MAX,
  TAU_SWEEP_GRID,
  cRate,
  outcomeAtTau,
  parseMinSupport,
  sweepTau,
} from '../../src/eval/l1-matrix.js';

describe('cRate', () => {
  it('C/(C+D)；分母 0 → null', () => {
    expect(cRate({ A: 1, B: 0, C: 1, D: 1 })).toBe(0.5);
    expect(cRate({ A: 1, B: 0, C: 0, D: 0 })).toBeNull();
  });
});

describe('parseMinSupport', () => {
  it('缺 / 非有限 / 越界 → null', () => {
    expect(parseMinSupport(undefined)).toBeNull();
    expect(parseMinSupport(null)).toBeNull();
    expect(parseMinSupport('0.9')).toBeNull();
    expect(parseMinSupport(Number.NaN)).toBeNull();
    expect(parseMinSupport(-0.1)).toBeNull();
    expect(parseMinSupport(1.1)).toBeNull();
  });

  it('闭区间 [0,1] 原样', () => {
    expect(parseMinSupport(0)).toBe(0);
    expect(parseMinSupport(1)).toBe(1);
    expect(parseMinSupport(0.4)).toBe(0.4);
  });
});

describe('outcomeAtTau', () => {
  it('error 每一档仍是 error', () => {
    expect(outcomeAtTau('error', 0.9, 0.3)).toBe('error');
  });

  it('无分数保持原 outcome', () => {
    expect(outcomeAtTau('abstained', null, 0.3)).toBe('abstained');
    expect(outcomeAtTau('answered', null, 0.9)).toBe('answered');
  });

  it('有分：≥τ answered，否则 abstained', () => {
    expect(outcomeAtTau('abstained', 0.4, 0.3)).toBe('answered');
    expect(outcomeAtTau('answered', 0.4, 0.5)).toBe('abstained');
    expect(outcomeAtTau('answered', 0.5, 0.5)).toBe('answered');
  });
});

describe('sweepTau', () => {
  it('缺不可答分母 → tauStar null', () => {
    const r = sweepTau([{ type: 'answerable', outcome: 'answered', minSupport: 0.9 }]);
    expect(r.tauStar).toBeNull();
    expect(r.grid).toHaveLength(TAU_SWEEP_GRID.length);
  });

  it('满足试点硬门时取最大 τ', () => {
    const r = sweepTau([
      { type: 'answerable', outcome: 'answered', minSupport: 0.8 },
      { type: 'answerable', outcome: 'abstained', minSupport: 0.4 },
      { type: 'unanswerable', outcome: 'abstained', minSupport: 0.2 },
      { type: 'unanswerable', outcome: 'abstained', minSupport: 0.2 },
    ]);
    expect(TAU_STAR_COVERAGE_MIN).toBe(0.4);
    expect(TAU_STAR_C_RATE_MAX).toBe(0.05);
    expect(r.tauStar).toBe(0.8);
    const atStar = r.grid.find((p) => p.tau === r.tauStar);
    expect(atStar?.coverage).toBe(0.5);
    expect(atStar?.cRate).toBe(0);
  });

  it('整批无分数即使原格过门 → tauStar null，不得写成网格上沿', () => {
    const r = sweepTau([
      { type: 'answerable', outcome: 'answered' },
      { type: 'unanswerable', outcome: 'abstained' },
    ]);
    expect(r.grid[0]?.matrix).toEqual({ A: 1, B: 0, C: 0, D: 1 });
    expect(r.tauStar).toBeNull();
  });

  it('无分数的拒答不因降 τ 变成 answered', () => {
    const r = sweepTau(
      [
        { type: 'answerable', outcome: 'answered', minSupport: 0.9 },
        { type: 'unanswerable', outcome: 'abstained' },
      ],
      [0.3],
    );
    expect(r.grid[0]?.matrix).toEqual({ A: 1, B: 0, C: 0, D: 1 });
  });

  it('error 出格且不挡其它题计格', () => {
    const r = sweepTau(
      [
        { type: 'answerable', outcome: 'error', minSupport: 0.9 },
        { type: 'answerable', outcome: 'answered', minSupport: 0.9 },
        { type: 'unanswerable', outcome: 'abstained', minSupport: 0.1 },
      ],
      [0.5],
    );
    expect(r.grid[0]?.matrix).toEqual({ A: 1, B: 0, C: 0, D: 1 });
  });
});
