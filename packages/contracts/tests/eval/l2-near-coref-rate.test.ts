/**
 * 目标：L2 近指代通过率必须按「near_coref 行的机械 pass 比例」算（error 进分母），并真进工程 signoffEligible。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 :188（近指代主题正确且合法作答 ≥80%）
 * 被测：l2NearCorefPassRate · computeL2SignoffEligible
 * 简介：分母 0 → null → 不放行（fail-closed）；残余（不含主题正确 / 不含合法 citation / 夹具仅 3 条 near_coref）见源码注释。
 */

import { describe, expect, it } from 'vitest';

import { L2_NEAR_COREF_PASS_MIN, L2_TYPES, type L2Type } from '../../src/eval/l2-gold.js';
import { computeL2SignoffEligible, l2NearCorefPassRate } from '../../src/eval/l2-matrix.js';

function nearCoref(verdict: string): { type: L2Type; verdict: string } {
  return { type: 'near_coref', verdict };
}

/** 5 条 near_coref 里 pass 条数 */
function fiveNearCoref(pass: number): { type: L2Type; verdict: string }[] {
  return Array.from({ length: 5 }, (_, i) => nearCoref(i < pass ? 'pass' : 'fail'));
}

/** 九类必含 + 补齐到 15 题 */
function fullCases(): { type: L2Type }[] {
  const cases: { type: L2Type }[] = L2_TYPES.map((type) => ({ type }));
  while (cases.length < 15) cases.push({ type: 'near_coref' });
  return cases;
}

describe('l2NearCorefPassRate', () => {
  it('分母只取 near_coref：其它类题的 pass/fail/error 不进分子也不进分母', () => {
    expect(
      l2NearCorefPassRate([
        nearCoref('pass'),
        nearCoref('pass'),
        { type: 'topic_switch', verdict: 'fail' },
        { type: 'budget', verdict: 'error' },
        { type: 'weak_coref', verdict: 'pass' },
      ]),
    ).toBe(1);
  });

  it('无 near_coref 行 → 分母 0 → null（该门缺测，不放行）', () => {
    expect(l2NearCorefPassRate([])).toBeNull();
    expect(
      l2NearCorefPassRate([
        { type: 'weak_coref', verdict: 'pass' },
        { type: 'explicit_backref', verdict: 'pass' },
      ]),
    ).toBeNull();
  });

  it('恰好 80%（5 条 4 pass）达标；60%（5 条 3 pass）不达标', () => {
    expect(l2NearCorefPassRate(fiveNearCoref(4))).toBe(0.8);
    expect(l2NearCorefPassRate(fiveNearCoref(4))).toBe(L2_NEAR_COREF_PASS_MIN);
    expect(l2NearCorefPassRate(fiveNearCoref(3))).toBeLessThan(L2_NEAR_COREF_PASS_MIN);
  });

  it('全 error 的 near_coref → 率 0（error 进分母、不算 pass），不得退化成 null', () => {
    const rate = l2NearCorefPassRate([nearCoref('error'), nearCoref('error'), nearCoref('error')]);
    expect(rate).toBe(0);
    expect(rate).not.toBeNull();
  });
});

describe('computeL2SignoffEligible 近指代门', () => {
  const base = {
    retrieveMode: 'live' as const,
    cases: fullCases(),
    caseCount: 15,
    zeroToleranceHits: 0,
    nearCorefPassRate: 1 as number | null,
  };

  it('率 1 → true；恰好 0.8 → true；0.79 → false', () => {
    expect(computeL2SignoffEligible({ ...base })).toBe(true);
    expect(computeL2SignoffEligible({ ...base, nearCorefPassRate: L2_NEAR_COREF_PASS_MIN })).toBe(
      true,
    );
    expect(computeL2SignoffEligible({ ...base, nearCorefPassRate: 0.79 })).toBe(false);
  });

  it('率缺测（null，无 near_coref 题）→ false；率 0（全 error）→ false', () => {
    expect(computeL2SignoffEligible({ ...base, nearCorefPassRate: null })).toBe(false);
    expect(computeL2SignoffEligible({ ...base, nearCorefPassRate: 0 })).toBe(false);
  });

  it('回归钉：原有四项（live / ≥15 / 零容忍 / 九类）各自仍单独压成 false', () => {
    const ok = { ...base, nearCorefPassRate: 1 };
    expect(computeL2SignoffEligible({ ...ok, retrieveMode: 'mock' })).toBe(false);
    expect(computeL2SignoffEligible({ ...ok, retrieveMode: 'unknown' })).toBe(false);
    expect(computeL2SignoffEligible({ ...ok, caseCount: 14 })).toBe(false);
    expect(computeL2SignoffEligible({ ...ok, zeroToleranceHits: 1 })).toBe(false);
    expect(
      computeL2SignoffEligible({
        ...ok,
        cases: fullCases().filter((c) => c.type !== 'session_isolation'),
      }),
    ).toBe(false);
  });
});
