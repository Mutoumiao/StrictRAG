/**
 * 目标：有 expectedDocIds 的 L1 题必须按 evidence 交集计 Hit@k，无名单不计分。
 * 需求：覆盖 C4 · prds/08-quality
 * 被测：hitAtKCase · accumulateHitAtK · hitAtKRate
 * 简介：不进 2×2 / signoffEligible；不是人签。
 */

import { describe, expect, it } from 'vitest';

import {
  accumulateHitAtK,
  emptyHitAtK,
  hitAtKCase,
  hitAtKRate,
  parseExpectedDocIds,
} from '../../src/eval/l1-matrix.js';

describe('hitAtKCase', () => {
  it('缺 expected / 空数组 / 全空白 → null', () => {
    expect(hitAtKCase(undefined, ['d1'])).toBeNull();
    expect(hitAtKCase(null, ['d1'])).toBeNull();
    expect(hitAtKCase([], ['d1'])).toBeNull();
    expect(hitAtKCase(['', '  '], ['d1'])).toBeNull();
  });

  it('evidence 含任一 expected → true', () => {
    expect(hitAtKCase(['a', 'b'], ['x', 'b', 'y'])).toBe(true);
  });

  it('evidence 全未命中或为空 → false', () => {
    expect(hitAtKCase(['a'], ['x', 'y'])).toBe(false);
    expect(hitAtKCase(['a'], [])).toBe(false);
  });
});

describe('parseExpectedDocIds', () => {
  it('缺字段 / null / 空数组 / 全空白 → null', () => {
    expect(parseExpectedDocIds(undefined)).toBeNull();
    expect(parseExpectedDocIds(null)).toBeNull();
    expect(parseExpectedDocIds([])).toBeNull();
    expect(parseExpectedDocIds(['', '  '])).toBeNull();
  });

  it('合法字符串 trim 后保留', () => {
    expect(parseExpectedDocIds([' a ', 'b'])).toEqual(['a', 'b']);
  });

  it('非数组或含非字符串 → 抛错', () => {
    expect(() => parseExpectedDocIds('doc-a')).toThrow(/string\[\]/);
    expect(() => parseExpectedDocIds([1])).toThrow(/only strings/);
    expect(() => parseExpectedDocIds(['a', 1])).toThrow(/only strings/);
  });
});

describe('hitAtKRate', () => {
  it('分母 0 → null', () => {
    expect(hitAtKRate(emptyHitAtK())).toBeNull();
  });

  it('只累计非 null；命中率 = hits/scored', () => {
    const acc = emptyHitAtK();
    accumulateHitAtK(acc, null);
    accumulateHitAtK(acc, true);
    accumulateHitAtK(acc, false);
    expect(acc).toEqual({ hits: 1, scored: 2 });
    expect(hitAtKRate(acc)).toBe(0.5);
  });
});
