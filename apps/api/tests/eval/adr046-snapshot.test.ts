/**
 * 目标：评测快照绑定硬门不得松于试点。
 * 需求：ADR-046
 * 被测：evaluateAdr046Bind / bindQualitySnapshotToEval
 * 简介：评测快照绑定硬门。
 */

import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { TauSweepCase } from '@strict-rag/contracts';

import {
  PILOT_HARD_GATES,
  allInternalGuard,
  bindQualitySnapshotToEval,
  compareHardGates,
  evaluateAdr046Bind,
  fourElementsComplete,
  fourElementsOf,
  isStricterThanPilot,
  snapshotBindIdentity,
  writeBoundSnapshot,
  type HardGates,
} from '../../src/eval/adr046-snapshot.js';

const tmpDirs: string[] = [];

afterEach(() => {
  while (tmpDirs.length) {
    const d = tmpDirs.pop();
    if (d) rmSync(d, { recursive: true, force: true });
  }
});

function tmp(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'adr046-'));
  tmpDirs.push(d);
  return d;
}

function completeFour(over: Partial<Parameters<typeof fourElementsOf>[0]> = {}) {
  return fourElementsOf({
    kbId: 'kb-1',
    tauClaim: 0.5,
    gates: { ...PILOT_HARD_GATES },
    evalRunId: 'eval-1',
    ranAt: '2026-08-14T00:00:00.000Z',
    proposal: true,
    businessR: true,
    productA: true,
    ...over,
  });
}

describe('compareHardGates / isStricterThanPilot', () => {
  it('试点全等 → equal，不是 stricter', () => {
    const diff = compareHardGates({ ...PILOT_HARD_GATES });
    expect(diff.direction).toBe('equal');
    expect(diff.loosenedKeys).toEqual([]);
    expect(isStricterThanPilot({ ...PILOT_HARD_GATES })).toBe(false);
  });

  it('覆盖率下限上调 → stricter', () => {
    const gates: HardGates = { ...PILOT_HARD_GATES, coverageMin: 0.5 };
    expect(compareHardGates(gates).direction).toBe('stricter');
    expect(isStricterThanPilot(gates)).toBe(true);
  });

  it('C 率上限放宽 → looser，拒绝加严', () => {
    const gates: HardGates = { ...PILOT_HARD_GATES, cRateMax: 0.1 };
    const diff = compareHardGates(gates);
    expect(diff.direction).toBe('looser');
    expect(diff.loosenedKeys).toEqual(['cRateMax']);
    expect(isStricterThanPilot(gates)).toBe(false);
  });

  it('一边加严一边放宽 → looser（禁止借加严放宽）', () => {
    const gates: HardGates = { ...PILOT_HARD_GATES, coverageMin: 0.6, cRateMax: 0.2 };
    expect(compareHardGates(gates).direction).toBe('looser');
  });
});

describe('fourElements', () => {
  it('四项齐 → complete', () => {
    expect(fourElementsComplete(completeFour())).toBe(true);
  });

  it('缺提案或签字 → 不齐', () => {
    expect(fourElementsComplete(completeFour({ proposal: false }))).toBe(false);
    expect(fourElementsComplete(completeFour({ businessR: false }))).toBe(false);
  });
});

describe('evaluateAdr046Bind', () => {
  it('四要素齐 + 未放宽 + live 覆盖 >0 → 可标已签字包且业务 PASS', () => {
    const verdict = evaluateAdr046Bind({
      four: completeFour(),
      diff: compareHardGates({ ...PILOT_HARD_GATES }),
      signoffEligible: true,
      coverage: 0.5,
      caseReasons: ['verified'],
    });
    expect(verdict.signedPackage).toBe(true);
    expect(verdict.businessPass).toBe(true);
  });

  it('硬门放宽 → 不得标已签字', () => {
    const verdict = evaluateAdr046Bind({
      four: completeFour(),
      diff: compareHardGates({ ...PILOT_HARD_GATES, cRateMax: 0.1 }),
      signoffEligible: true,
      coverage: 0.5,
    });
    expect(verdict.signedPackage).toBe(false);
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('loosened_hard_gate');
  });

  it('缺四要素 → 不得标已签字', () => {
    const verdict = evaluateAdr046Bind({
      four: completeFour({ proposal: false, businessR: false, productA: false }),
      diff: compareHardGates({ ...PILOT_HARD_GATES }),
      signoffEligible: true,
      coverage: 0.5,
    });
    expect(verdict.signedPackage).toBe(false);
    expect(verdict.reasons).toContain('missing_proposal');
    expect(verdict.reasons).toContain('missing_signatures');
  });

  it('coverage=0 不得翻业务 PASS', () => {
    const verdict = evaluateAdr046Bind({
      four: completeFour(),
      diff: compareHardGates({ ...PILOT_HARD_GATES }),
      signoffEligible: true,
      coverage: 0,
      caseReasons: ['verified'],
    });
    expect(verdict.signedPackage).toBe(true);
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('coverage_zero_or_null');
  });

  it('全 internal_guard 不得翻业务 PASS', () => {
    const verdict = evaluateAdr046Bind({
      four: completeFour(),
      diff: compareHardGates({ ...PILOT_HARD_GATES }),
      signoffEligible: true,
      coverage: 0.4,
      caseReasons: ['internal_guard', 'internal_guard'],
    });
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('internal_guard');
    expect(allInternalGuard(['internal_guard', 'internal_guard'])).toBe(true);
  });
});

describe('bindQualitySnapshotToEval + writeBoundSnapshot', () => {
  const base = {
    snapshotId: 'snap-1',
    kbId: 'kb-live',
    evalRunId: 'eval-live-1',
    ranAt: '2026-08-14T12:00:00.000Z',
    retrieve_mode: 'live' as const,
    tauClaim: 0.5,
    gates: { ...PILOT_HARD_GATES },
    proposal: false,
    businessR: false,
    productA: false,
    signoffEligible: true,
    coverage: 0,
    caseReasons: ['internal_guard'],
  };

  it('绑定 live eval 身份；缺人签 + coverage=0 不标 PASS', () => {
    const { snapshot, verdict } = bindQualitySnapshotToEval(base);
    expect(snapshot.evalBindId).toBe('eval-live-1');
    expect(snapshot.evalRunId).toBe('eval-live-1');
    expect(snapshot.gate_bundle).toBe('pilot');
    expect(verdict.bindable).toBe(true);
    expect(verdict.signedPackage).toBe(false);
    expect(verdict.businessPass).toBe(false);
    expect(snapshotBindIdentity(base)).toBe('eval-live-1');
  });

  it('同一入口跑两次：绑定身份稳定，业务 PASS 仍为 false', () => {
    const a = bindQualitySnapshotToEval({ ...base, snapshotId: 's-a' });
    const b = bindQualitySnapshotToEval({ ...base, snapshotId: 's-b' });
    expect(a.snapshot.evalBindId).toBe(b.snapshot.evalBindId);
    expect(a.verdict.businessPass).toBe(false);
    expect(b.verdict.businessPass).toBe(false);
    expect(a.verdict.signedPackage).toBe(b.verdict.signedPackage);

    const dir = tmp();
    const p1 = writeBoundSnapshot(dir, a.snapshot, a.verdict);
    const p2 = writeBoundSnapshot(dir, b.snapshot, b.verdict);
    expect(p1.jsonPath).toBe(p2.jsonPath);
    const written = JSON.parse(readFileSync(p2.jsonPath, 'utf8')) as {
      snapshot: { evalBindId: string };
      verdict: { businessPass: boolean; signedPackage: boolean };
    };
    expect(written.snapshot.evalBindId).toBe('eval-live-1');
    expect(written.verdict.businessPass).toBe(false);
    expect(written.verdict.signedPackage).toBe(false);
  });

  it('无 evalRunId 时用 report:kb:ranAt 绑定', () => {
    const { snapshot } = bindQualitySnapshotToEval({ ...base, evalRunId: null });
    expect(snapshot.evalBindId).toBe('report:kb-live:2026-08-14T12:00:00.000Z');
    expect(snapshot.fourElements.l1RerunBound).toBe(true);
  });
});

describe('剧本 T1 · 未声明加严的 KB 锚定试点默认包', () => {
  it('不传 gates → 门禁包 = pilot 默认、无加严标记、可逐项打印数字', () => {
    const { snapshot } = bindQualitySnapshotToEval({
      snapshotId: 'snap-t1',
      kbId: 'kb-default',
      ranAt: '2026-09-20T00:00:00.000Z',
      retrieve_mode: 'mock',
      tauClaim: 0.5,
      signoffEligible: false,
      coverage: null,
    });

    expect(snapshot.gates).toEqual(PILOT_HARD_GATES);
    expect(snapshot.gate_bundle).toBe('pilot');
    expect(snapshot.stricterThanPilot).toBe(false);
    expect(snapshot.loosenedKeys).toEqual([]);
    expect(compareHardGates(snapshot.gates).direction).toBe('equal');
    // 「可打印」即数字可从快照条目读出，不是只有常量本身
    expect(snapshot.gates.cRateMax).toBe(0.05);
    expect(snapshot.gates.coverageMin).toBe(0.4);
    expect(snapshot.gates.citationCompleteMin).toBe(0.99);
  });
});

describe('剧本 T2 · 放宽硬门（无 ADR / 会签）不得生效', () => {
  it('C 上限改 8% → looser：不加严、不标已签字包、不翻业务 PASS，写出的裁决也拒绝', () => {
    const gates: HardGates = { ...PILOT_HARD_GATES, cRateMax: 0.08 };
    const { snapshot, verdict } = bindQualitySnapshotToEval({
      snapshotId: 'snap-t2',
      kbId: 'kb-loosen',
      evalRunId: 'eval-live-loosen',
      ranAt: '2026-09-20T00:00:00.000Z',
      retrieve_mode: 'live',
      tauClaim: 0.5,
      gates,
      proposal: true,
      businessR: true,
      productA: true,
      signoffEligible: true,
      coverage: 0.5,
      caseReasons: ['verified'],
    });

    expect(compareHardGates(snapshot.gates).direction).toBe('looser');
    expect(snapshot.loosenedKeys).toEqual(['cRateMax']);
    expect(snapshot.stricterThanPilot).toBe(false);
    expect(snapshot.gate_bundle).toBe('pilot');
    expect(verdict.signedPackage).toBe(false);
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('loosened_hard_gate');

    // 落盘产物同样拒绝：任何下游读该文件都看不到 signedPackage=true
    const dir = tmp();
    const { jsonPath } = writeBoundSnapshot(dir, snapshot, verdict);
    const written = JSON.parse(readFileSync(jsonPath, 'utf8')) as {
      snapshot: { gates: { cRateMax: number }; stricterThanPilot: boolean };
      verdict: { signedPackage: boolean; businessPass: boolean; reasons: string[] };
    };
    expect(written.snapshot.gates.cRateMax).toBe(0.08);
    expect(written.snapshot.stricterThanPilot).toBe(false);
    expect(written.verdict.signedPackage).toBe(false);
    expect(written.verdict.businessPass).toBe(false);
    expect(written.verdict.reasons).toContain('loosened_hard_gate');
  });
});

describe('剧本 P6 · L1 门禁条件不含 aux_*', () => {
  it('试点硬门键名无 aux_ / min_support（aux 分不得进 L1 门禁）', () => {
    const keys = Object.keys(PILOT_HARD_GATES);
    expect(keys.some((k) => k.toLowerCase().startsWith('aux'))).toBe(false);
    expect(keys).not.toContain('min_support');
    expect(keys).not.toContain('minSupport');
  });

  it('类型层：aux_* 不得写进硬门键，aux 分数对象不得当 min_support 传递', () => {
    // @ts-expect-error aux_* 不是试点硬门键（类型层拒绝 aux 混入 L1 门禁）
    const withAux: HardGates = { ...PILOT_HARD_GATES, auxJudgeAuroc: 0.9 };
    expect(withAux.cRateMax).toBe(PILOT_HARD_GATES.cRateMax);

    type MinSupport = NonNullable<TauSweepCase['minSupport']>;
    // @ts-expect-error aux 分数对象不是 min_support 数值（两者不可互赋）
    const wrong: MinSupport = { auxJudgeAuroc: 0.9 };
    expect(wrong).not.toBeNull();
  });
});
