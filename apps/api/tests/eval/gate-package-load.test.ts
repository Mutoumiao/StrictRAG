/**
 * 目标：签字包的 τ 能被安全取出，并按 §6.0「加载」行判定能否加载 —— 不一致与未记录都拒绝加载。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.0 加载行 · ADR-046 决策 #4 · ADR-062
 * 被测：judgeGatePackageLoad · signoffPackageTauFromReport
 * 简介：严格相等、无容差；缺键 / null / 非有限数一律判「未记录」（不 Number() 强转成数字）。
 */

import { describe, expect, it } from 'vitest';

import { judgeGatePackageLoad } from '../../src/eval/gate-package-load.js';
import { signoffPackageTauFromReport } from '../../src/services/eval-runs.js';

describe('signoffPackageTauFromReport · 从 report_json 取本跑冻结的 τ', () => {
  it('有限数照样取出（0 与 1 都是合法值，不得当假值丢掉）', () => {
    expect(signoffPackageTauFromReport({ repro: { tauClaim: 0.5 } })).toBe(0.5);
    expect(signoffPackageTauFromReport({ repro: { tauClaim: 0 } })).toBe(0);
    expect(signoffPackageTauFromReport({ repro: { tauClaim: 1 } })).toBe(1);
  });

  it('缺键 / null / 非对象 → 未记录（null）', () => {
    expect(signoffPackageTauFromReport({ repro: { tauClaim: null } })).toBeNull();
    expect(signoffPackageTauFromReport({ repro: {} })).toBeNull();
    expect(signoffPackageTauFromReport({})).toBeNull();
    expect(signoffPackageTauFromReport({ repro: null })).toBeNull();
    expect(signoffPackageTauFromReport(null)).toBeNull();
    expect(signoffPackageTauFromReport('0.5')).toBeNull();
  });

  it('非有限数 / 字符串数字一律未记录（不做强转 —— 强转出来的 0 会变成一条假绑定）', () => {
    expect(signoffPackageTauFromReport({ repro: { tauClaim: Number.NaN } })).toBeNull();
    expect(
      signoffPackageTauFromReport({ repro: { tauClaim: Number.POSITIVE_INFINITY } }),
    ).toBeNull();
    expect(signoffPackageTauFromReport({ repro: { tauClaim: '0.5' } })).toBeNull();
    expect(signoffPackageTauFromReport({ repro: { tauClaim: true } })).toBeNull();
  });

  it('repro 本身不是普通对象（数组 / 字符串）→ 未记录，且不得抛错', () => {
    expect(signoffPackageTauFromReport({ repro: [] })).toBeNull();
    expect(signoffPackageTauFromReport({ repro: 'x' })).toBeNull();
    expect(signoffPackageTauFromReport({ repro: [0.5] })).toBeNull();
  });
});

describe('judgeGatePackageLoad · §6.0 加载判定', () => {
  it('相等 → 可加载', () => {
    expect(judgeGatePackageLoad({ packageTau: 0.5, runtimeTau: 0.5 })).toEqual({
      loadable: true,
      tauClaim: 0.5,
    });
    expect(judgeGatePackageLoad({ packageTau: 0, runtimeTau: 0 }).loadable).toBe(true);
    expect(judgeGatePackageLoad({ packageTau: 1, runtimeTau: 1 }).loadable).toBe(true);
  });

  it('不等 → 拒绝加载，reason = tau_mismatch', () => {
    expect(judgeGatePackageLoad({ packageTau: 0.5, runtimeTau: 0.6 })).toEqual({
      loadable: false,
      reason: 'tau_mismatch',
    });
  });

  it('无容差：差一个浮点尾数也算不一致', () => {
    expect(judgeGatePackageLoad({ packageTau: 0.5, runtimeTau: 0.5000001 })).toEqual({
      loadable: false,
      reason: 'tau_mismatch',
    });
  });

  it('包内未记录（null / NaN）→ 同样拒绝加载，reason = tau_unrecorded', () => {
    expect(judgeGatePackageLoad({ packageTau: null, runtimeTau: 0.5 })).toEqual({
      loadable: false,
      reason: 'tau_unrecorded',
    });
    expect(judgeGatePackageLoad({ packageTau: Number.NaN, runtimeTau: 0.5 })).toEqual({
      loadable: false,
      reason: 'tau_unrecorded',
    });
  });

  it('越过类型的输入也算「未记录」：非 number 的 packageTau 不得判成「不一致」', () => {
    // 生产路径不会走到（`signoffPackageTauFromReport` 已先过滤），此处钉住「非数 = 未记录」这一语义
    expect(
      judgeGatePackageLoad({ packageTau: '0.5' as unknown as number, runtimeTau: 0.5 }).reason,
    ).toBe('tau_unrecorded');
  });

  it('运行时 τ 非有限（env 侧由 zod 挡住，不可达）→ 判「不一致」，不放行', () => {
    expect(judgeGatePackageLoad({ packageTau: 0.5, runtimeTau: Number.NaN })).toEqual({
      loadable: false,
      reason: 'tau_mismatch',
    });
  });
});
