/**
 * 目标：有 expectedDocIds 的 L1 题必须按 evidence 交集计 Hit@k，无名单不计分，且逻辑 id→uuid 映射层不得伪命中。
 * 需求：覆盖 C4 · prds/08-quality
 * 被测：hitAtKCase · accumulateHitAtK · hitAtKRate
 * 简介：不进 2×2 / signoffEligible；不是人签；未映射的逻辑 id 与 KB uuid 只有逐字全等才算命中。
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

/**
 * 映射层（逻辑 id → KB uuid）：gold 里写的是逻辑 id（如 `ingest-samples/01-doc`），
 * 报告要按当前 KB 的 documents.id 算交集，映射由调用方在跑批前完成。
 * 本层只允逐字全等，禁模糊匹配，否则未映射的名单会被伪命中抬高 Hit@k。
 */
describe('逻辑 id→uuid 映射层', () => {
  const LOGICAL_ID = 'ingest-samples/01-doc';
  const UUID = '01900000-0000-7000-8000-0000000000d1';

  it('逻辑 id 未映射为 uuid 时不算命中，也不抛错（映射缺失只降 Hit@k）', () => {
    expect(hitAtKCase([LOGICAL_ID], [UUID])).toBe(false);
    expect(hitAtKCase([UUID], [LOGICAL_ID])).toBe(false);
  });

  it('把名单换成同一 evidence 的 uuid 后才算命中', () => {
    expect(hitAtKCase([UUID], [UUID])).toBe(true);
    expect(hitAtKCase([UUID], [UUID, LOGICAL_ID])).toBe(true);
  });

  it('只按 trim 后全等比较：大小写 / 前缀 / 后缀差异都不得当命中', () => {
    expect(hitAtKCase([` ${UUID} `], [UUID])).toBe(true);
    expect(hitAtKCase([UUID.toUpperCase()], [UUID])).toBe(false);
    expect(hitAtKCase([UUID.slice(0, 8)], [UUID])).toBe(false);
    expect(hitAtKCase([`${UUID}-v2`], [UUID])).toBe(false);
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
