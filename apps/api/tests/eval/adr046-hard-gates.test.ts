/**
 * 目标：L1 四项实测硬门 + 引用完整率必须真进 ADR-046 放行判定，且方向只加严。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §2 :79-81 · §3 :89 · §4 :97-99 · §6 :132-138
 * 被测：evaluateAdr046Bind
 * 简介：逐项边界（恰好达标 / 差一点 / 缺测）+ 「覆盖率 0.001 也能变真」的旧宽松口径回归钉。
 */

import { describe, expect, it } from 'vitest';

import {
  PILOT_HARD_GATES,
  compareHardGates,
  evaluateAdr046Bind,
  fourElementsOf,
} from '../../src/eval/adr046-snapshot.js';

/** 四要素齐 + 试点默认包（不放宽）→ signedPackage 恒真，单独观察实测门 */
function bind(over: {
  coverage: number | null;
  cRate?: number | null;
  hitAtK?: number | null;
  judgeAuroc?: number | null;
  citationComplete?: number | null;
}) {
  const gates = { ...PILOT_HARD_GATES };
  const four = fourElementsOf({
    kbId: 'kb-1',
    tauClaim: 0.5,
    gates,
    evalRunId: 'eval-1',
    ranAt: '2026-09-20T00:00:00.000Z',
    proposal: true,
    businessR: true,
    productA: true,
  });
  return evaluateAdr046Bind({
    four,
    diff: compareHardGates(gates),
    signoffEligible: true,
    caseReasons: ['verified'],
    ...over,
  });
}

/** 五项实测全达标基线；测边界时只改被测的那一项 */
const ALL_PASS = {
  coverage: 0.5,
  cRate: 0.03,
  hitAtK: 0.75,
  judgeAuroc: 0.7,
  citationComplete: 1,
};

describe('L1 实测硬门进 ADR-046 放行判定', () => {
  it('五项实测全达标 + 四要素齐 + 未放宽 → 业务 PASS', () => {
    const verdict = bind({ ...ALL_PASS });
    expect(verdict.signedPackage).toBe(true);
    expect(verdict.businessPass).toBe(true);
    expect(verdict.reasons).not.toContain('coverage_below_min');
  });

  it('coverage 恰好 0.4 过；0.39 不过；null 不过', () => {
    expect(bind({ ...ALL_PASS, coverage: 0.4 }).businessPass).toBe(true);

    const below = bind({ ...ALL_PASS, coverage: 0.39 });
    expect(below.businessPass).toBe(false);
    expect(below.reasons).toContain('coverage_below_min');

    const nul = bind({ ...ALL_PASS, coverage: null });
    expect(nul.businessPass).toBe(false);
    expect(nul.reasons).toContain('coverage_zero_or_null');
  });

  it('cRate 恰好 0.05 过；0.051 不过；null 不过', () => {
    expect(bind({ ...ALL_PASS, cRate: 0.05 }).businessPass).toBe(true);

    const above = bind({ ...ALL_PASS, cRate: 0.051 });
    expect(above.businessPass).toBe(false);
    expect(above.reasons).toContain('c_rate_missing_or_above_max');

    const nul = bind({ ...ALL_PASS, cRate: null });
    expect(nul.businessPass).toBe(false);
    expect(nul.reasons).toContain('c_rate_missing_or_above_max');
  });

  it('hitAtK 恰好 0.7 过；0.69 不过；null 过（无标注 = 该门不适用）', () => {
    expect(bind({ ...ALL_PASS, hitAtK: 0.7 }).businessPass).toBe(true);

    const below = bind({ ...ALL_PASS, hitAtK: 0.69 });
    expect(below.businessPass).toBe(false);
    expect(below.reasons).toContain('hit_at_k_below_min');

    const unlabeled = bind({ ...ALL_PASS, hitAtK: null });
    expect(unlabeled.businessPass).toBe(true);
    expect(unlabeled.reasons).not.toContain('hit_at_k_below_min');
  });

  it('judgeAuroc 恰好 0.65 过；0.64 不过；null 不过（缺测显形为红）', () => {
    expect(bind({ ...ALL_PASS, judgeAuroc: 0.65 }).businessPass).toBe(true);

    const below = bind({ ...ALL_PASS, judgeAuroc: 0.64 });
    expect(below.businessPass).toBe(false);
    expect(below.reasons).toContain('judge_auroc_missing_or_below_min');

    const nul = bind({ ...ALL_PASS, judgeAuroc: null });
    expect(nul.businessPass).toBe(false);
    expect(nul.reasons).toContain('judge_auroc_missing_or_below_min');
  });

  it('citationComplete 0.99 / null 过；0.98 不过', () => {
    expect(bind({ ...ALL_PASS, citationComplete: 0.99 }).businessPass).toBe(true);
    expect(bind({ ...ALL_PASS, citationComplete: null }).businessPass).toBe(true);

    const below = bind({ ...ALL_PASS, citationComplete: 0.98 });
    expect(below.businessPass).toBe(false);
    expect(below.reasons).toContain('citation_complete_below_min');
  });

  it('回归钉：coverage=0.001 且其余五项全过 → 业务 PASS 必须为 false', () => {
    // 旧口径 coverage > 0 即算过门：0.001 也能变真。本工单把该假绿钉死。
    const verdict = bind({ ...ALL_PASS, coverage: 0.001 });
    expect(verdict.signedPackage).toBe(true);
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('coverage_below_min');
  });
});
