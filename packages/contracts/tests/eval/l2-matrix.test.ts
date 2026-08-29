/**
 * 目标：L2 工程 signoffEligible 必须 live ∧ 九类齐 ∧ 零容忍=0 ∧ ≥15；mock 必 false。
 * 需求：功能表 §10.2 · prds/08-quality §6.2
 * 被测：computeL2SignoffEligible · historyLeaked · acceptHit · nextSessionId
 * 简介：工程公式 ≠ 准出 PASS / ≠ 人签。
 */

import { describe, expect, it } from 'vitest';

import { L2_TYPES, type L2Type } from '../../src/eval/l2-gold.js';
import {
  acceptHit,
  computeL2SignoffEligible,
  historyLeaked,
  nextSessionId,
} from '../../src/eval/l2-matrix.js';

function allTypes(): { type: L2Type }[] {
  return L2_TYPES.map((type) => ({ type }));
}

describe('computeL2SignoffEligible', () => {
  it('live + 九类 + ≥15 + 零泄漏 → true', () => {
    expect(
      computeL2SignoffEligible({
        retrieveMode: 'live',
        cases: [...allTypes(), { type: 'near_coref' }, { type: 'near_coref' }, { type: 'near_coref' }, { type: 'near_coref' }, { type: 'budget' }, { type: 'adversarial' }],
        caseCount: 15,
        zeroToleranceHits: 0,
      }),
    ).toBe(true);
  });

  it('mock / 缺类 / 泄漏 / 不足 15 → false', () => {
    const liveOk = {
      retrieveMode: 'live' as const,
      cases: allTypes(),
      caseCount: 15,
      zeroToleranceHits: 0,
    };
    expect(computeL2SignoffEligible({ ...liveOk, retrieveMode: 'mock' })).toBe(false);
    expect(computeL2SignoffEligible({ ...liveOk, caseCount: 14 })).toBe(false);
    expect(computeL2SignoffEligible({ ...liveOk, zeroToleranceHits: 1 })).toBe(false);
    expect(
      computeL2SignoffEligible({ ...liveOk, cases: allTypes().filter((c) => c.type !== 'budget') }),
    ).toBe(false);
  });
});

describe('historyLeaked / acceptHit / nextSessionId', () => {
  it('prior user text in evidence is leak; accept matches status or reason', () => {
    expect(historyLeaked(['住宿标准见第3条'], ['住宿标准见第3条'])).toBe(true);
    expect(historyLeaked(['条款'], ['那餐补呢'])).toBe(false);
    expect(acceptHit(['answered'], 'answered')).toBe(true);
    expect(acceptHit(['coref_unresolved'], 'abstained', 'coref_unresolved')).toBe(true);
    expect(acceptHit(['answered'], 'abstained', 'low_retrieval')).toBe(false);
  });

  it('session none/new/same', () => {
    expect(nextSessionId('none', 's1', () => 'n')).toBeUndefined();
    expect(nextSessionId('new', 's1', () => 'n2')).toBe('n2');
    expect(nextSessionId('same', 's1', () => 'n2')).toBe('s1');
    expect(nextSessionId('same', null, () => 'n2')).toBe('n2');
  });
});
