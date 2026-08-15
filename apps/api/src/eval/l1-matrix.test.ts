import { describe, expect, it } from 'vitest';

import {
  accumulate,
  cellFor,
  computeSignoffEligible,
  coverage,
  emptyMatrix,
  goldTypeCounts,
  SIGNOFF_MIN_PER_CLASS,
  type GoldType,
  type L1Outcome,
} from './l1-matrix.js';

describe('cellFor', () => {
  it('answerable × answered/abstained → A/B', () => {
    expect(cellFor('answerable', 'answered')).toBe('A');
    expect(cellFor('answerable', 'abstained')).toBe('B');
  });

  it('unanswerable|false_premise × answered/abstained → C/D', () => {
    expect(cellFor('unanswerable', 'answered')).toBe('C');
    expect(cellFor('unanswerable', 'abstained')).toBe('D');
    expect(cellFor('false_premise', 'answered')).toBe('C');
    expect(cellFor('false_premise', 'abstained')).toBe('D');
  });

  it('error 不计格', () => {
    for (const t of ['answerable', 'unanswerable', 'false_premise'] as GoldType[]) {
      expect(cellFor(t, 'error')).toBeNull();
    }
  });
});

describe('accumulate', () => {
  it('四格累加 + error 只增 errorCount 不改格', () => {
    const m = emptyMatrix();
    let errors = 0;
    const steps: [GoldType, L1Outcome][] = [
      ['answerable', 'answered'],
      ['answerable', 'abstained'],
      ['unanswerable', 'answered'],
      ['false_premise', 'abstained'],
      ['answerable', 'error'],
      ['unanswerable', 'error'],
    ];
    for (const [t, o] of steps) {
      errors += accumulate(m, t, o);
    }
    expect(m).toEqual({ A: 1, B: 1, C: 1, D: 1 });
    expect(errors).toBe(2);
  });
});

describe('coverage', () => {
  it('A/(A+B)', () => {
    expect(coverage({ A: 2, B: 2, C: 9, D: 9 })).toBe(0.5);
    expect(coverage({ A: 3, B: 1, C: 0, D: 0 })).toBe(0.75);
  });

  it('分母 0 → null', () => {
    expect(coverage(emptyMatrix())).toBeNull();
    expect(coverage({ A: 0, B: 0, C: 5, D: 5 })).toBeNull();
  });
});

describe('goldTypeCounts', () => {
  it('false_premise 计入不可答类', () => {
    expect(
      goldTypeCounts([
        { type: 'answerable' },
        { type: 'answerable' },
        { type: 'unanswerable' },
        { type: 'false_premise' },
      ]),
    ).toEqual({ answerable: 2, unanswerableClass: 2 });
  });
});

describe('computeSignoffEligible', () => {
  const full = {
    answerable: SIGNOFF_MIN_PER_CLASS,
    unanswerableClass: SIGNOFF_MIN_PER_CLASS,
  };

  it('仅 live 且两类各≥30 为 true', () => {
    expect(computeSignoffEligible('live', full)).toBe(true);
  });

  it('mock / unknown 即使满规模也 false', () => {
    expect(computeSignoffEligible('mock', full)).toBe(false);
    expect(computeSignoffEligible('unknown', full)).toBe(false);
  });

  it('live 但截断/缺类 false', () => {
    expect(
      computeSignoffEligible('live', {
        answerable: SIGNOFF_MIN_PER_CLASS,
        unanswerableClass: SIGNOFF_MIN_PER_CLASS - 1,
      }),
    ).toBe(false);
    expect(
      computeSignoffEligible('live', {
        answerable: 5,
        unanswerableClass: 5,
      }),
    ).toBe(false);
  });
});
