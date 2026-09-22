/**
 * 目标：PILOT_HARD_GATES 与 contracts 的 τ* 常量双写不得单边漂移。
 * 需求：ADR-046 · 02 裁定 7（不合一，但必须有一致性断言）
 * 被测：PILOT_HARD_GATES · TAU_STAR_COVERAGE_MIN · TAU_STAR_C_RATE_MAX
 * 简介：两份常量分别住 apps/api 与 packages/contracts（依赖方向只有 api → contracts），
 *       不合一（下沉会动 ADR-046 门禁包 7 键形状），故用本断言防未来单边改数。
 */

import { describe, expect, it } from 'vitest';

import { TAU_STAR_C_RATE_MAX, TAU_STAR_COVERAGE_MIN } from '@strict-rag/contracts';

import { PILOT_HARD_GATES } from '../../src/eval/adr046-snapshot.js';

describe('双写常量一致性（PILOT_HARD_GATES vs TAU_STAR_*）', () => {
  it('PILOT_HARD_GATES.coverageMin 与 TAU_STAR_COVERAGE_MIN 数值相等', () => {
    expect(PILOT_HARD_GATES.coverageMin).toBe(TAU_STAR_COVERAGE_MIN);
  });

  it('PILOT_HARD_GATES.cRateMax 与 TAU_STAR_C_RATE_MAX 数值相等', () => {
    expect(PILOT_HARD_GATES.cRateMax).toBe(TAU_STAR_C_RATE_MAX);
  });
});
