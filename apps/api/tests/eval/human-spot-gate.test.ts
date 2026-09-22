/**
 * 目标：人工抽检（PRD §6 硬门「≥20 条，错 ≤1」）必须真进 ADR-046 业务 PASS 判定，缺测不放行。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6（人工抽检 ≥20 条，错 ≤1）· ADR-046
 * 被测：evaluateAdr046Bind
 * 简介：条数 19/20/21 × 错数 0/1/2 边界；缺测 / 条数不足 / 错超限三种红各自可分辨；门限只读 PILOT_HARD_GATES。
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { JUDGE_CALIB_MIN_CASES } from '@strict-rag/contracts';

import {
  PILOT_HARD_GATES,
  compareHardGates,
  evaluateAdr046Bind,
  fourElementsOf,
  type HumanSpotCounts,
} from '../../src/eval/adr046-snapshot.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * 其余实测项全达标；被测只改 humanSpot / 显式传 undefined 表示缺测。
 * AUROC 来源与规模是另两条 fail-closed 门（另见 judge-auroc-source-gate.test.ts）：
 * 不喂满 → businessPass 恒红，就测不出抽检门本身。
 */
const OTHER_GATES_PASS = {
  coverage: 0.5,
  cRate: 0.03,
  hitAtK: 0.75,
  judgeAuroc: 0.7,
  judgeAurocSource: 'live' as const,
  judgeCalibPairs: JUDGE_CALIB_MIN_CASES,
  citationComplete: 1,
};

function bind(over: { humanSpot?: HumanSpotCounts }) {
  const gates = { ...PILOT_HARD_GATES };
  const four = fourElementsOf({
    kbId: 'kb-1',
    tauClaim: 0.5,
    gates,
    evalRunId: 'eval-1',
    ranAt: '2026-09-23T00:00:00.000Z',
    proposal: true,
    businessR: true,
    productA: true,
  });
  return evaluateAdr046Bind({
    four,
    diff: compareHardGates(gates),
    signoffEligible: true,
    ...OTHER_GATES_PASS,
    caseReasons: ['verified'],
    ...over,
  });
}

const REASONS = [
  'human_spot_missing',
  'human_spot_below_min',
  'human_spot_errors_above_max',
] as const;

describe('人工抽检进 ADR-046 业务 PASS', () => {
  it('缺测（没给账本）→ 不放行，且只报 missing', () => {
    const verdict = bind({});
    expect(verdict.signedPackage).toBe(true);
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('human_spot_missing');
    expect(verdict.reasons).not.toContain('human_spot_below_min');
    expect(verdict.reasons).not.toContain('human_spot_errors_above_max');
  });

  it('条数边界：19 不过（below_min）；20 / 21 过', () => {
    expect(bind({ humanSpot: { checked: 19, errors: 0 } }).businessPass).toBe(false);
    expect(bind({ humanSpot: { checked: 19, errors: 0 } }).reasons).toContain(
      'human_spot_below_min',
    );
    expect(bind({ humanSpot: { checked: 20, errors: 0 } }).businessPass).toBe(true);
    expect(bind({ humanSpot: { checked: 21, errors: 0 } }).businessPass).toBe(true);
  });

  it('错数边界：0 / 1 过；2 不过（errors_above_max）', () => {
    expect(bind({ humanSpot: { checked: 20, errors: 0 } }).businessPass).toBe(true);
    expect(bind({ humanSpot: { checked: 20, errors: 1 } }).businessPass).toBe(true);

    const above = bind({ humanSpot: { checked: 20, errors: 2 } });
    expect(above.businessPass).toBe(false);
    expect(above.reasons).toContain('human_spot_errors_above_max');
    expect(above.reasons).not.toContain('human_spot_below_min');
  });

  it('条数不足且错超限 → 两个 reason 同时出现（两种红可分辨）', () => {
    const verdict = bind({ humanSpot: { checked: 19, errors: 2 } });
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('human_spot_below_min');
    expect(verdict.reasons).toContain('human_spot_errors_above_max');
    expect(verdict.reasons).not.toContain('human_spot_missing');
  });

  it('登记了 0 条 0 错 → 仍不放行（不是「登记即放行」）', () => {
    const verdict = bind({ humanSpot: { checked: 0, errors: 0 } });
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('human_spot_below_min');
  });

  it('门限随常量走：恰好在 humanSpotMin / humanSpotErrorMax 上过，差一点即红', () => {
    // 若判定处改回写裸数字（不看常量），这条与上两条会一起红
    expect(
      bind({
        humanSpot: { checked: PILOT_HARD_GATES.humanSpotMin, errors: PILOT_HARD_GATES.humanSpotErrorMax },
      }).businessPass,
    ).toBe(true);
    expect(
      bind({
        humanSpot: {
          checked: PILOT_HARD_GATES.humanSpotMin - 1,
          errors: PILOT_HARD_GATES.humanSpotErrorMax,
        },
      }).businessPass,
    ).toBe(false);
    expect(
      bind({
        humanSpot: {
          checked: PILOT_HARD_GATES.humanSpotMin,
          errors: PILOT_HARD_GATES.humanSpotErrorMax + 1,
        },
      }).reasons,
    ).toContain('human_spot_errors_above_max');
  });

  it('三个 reason code 与既有命名风格一致（human_spot_* 前缀）', () => {
    for (const code of REASONS) {
      expect(code.startsWith('human_spot_')).toBe(true);
    }
    const src = readFileSync(path.join(here, '../../src/eval/adr046-snapshot.ts'), 'utf8');
    for (const code of REASONS) {
      expect(src).toContain(`'${code}'`);
    }
  });

  it('判定处不写裸数字：人工抽检门限一律读 PILOT_HARD_GATES', () => {
    const src = readFileSync(path.join(here, '../../src/eval/adr046-snapshot.ts'), 'utf8');
    const start = src.indexOf('const humanSpot = input.humanSpot');
    const end = src.indexOf('human_spot_errors_above_max');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const code = src
      .slice(start, end + 'human_spot_errors_above_max'.length)
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(code).toContain('gates.humanSpotMin');
    expect(code).toContain('gates.humanSpotErrorMax');
    // 门限 20 / 1 的裸字面量不得出现在判定分支里
    expect(/\b20\b/.test(code)).toBe(false);
    expect(/\b1\b/.test(code)).toBe(false);
  });
});
