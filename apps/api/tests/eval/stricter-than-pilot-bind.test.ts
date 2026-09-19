/**
 * 目标：加严快照必须标 stricterThanPilot，并带相对默认 diff 与 evalRunId 关联。
 * 需求：剧本 T7 · prds/10-delivery/03-acceptance-scenarios.md · ADR-046
 * 被测：bindQualitySnapshotToEval
 * 简介：coverageMin 上调后 stricterThanPilot 为 true，evalBindId 含该 evalRunId。不测人签/审计 HTTP。
 */

import { describe, expect, it } from 'vitest';

import {
  PILOT_HARD_GATES,
  bindQualitySnapshotToEval,
  compareHardGates,
} from '../../src/eval/adr046-snapshot.js';

describe('stricterThanPilot bind to eval run', () => {
  it('coverageMin up → stricterThanPilot and evalRunId association', () => {
    const evalRunId = 'eval-run-stricter-1';
    const { snapshot } = bindQualitySnapshotToEval({
      snapshotId: 'snap-t7',
      kbId: 'kb-1',
      evalRunId,
      ranAt: '2026-08-24T00:00:00.000Z',
      retrieve_mode: 'live',
      tauClaim: 0.5,
      gates: { ...PILOT_HARD_GATES, coverageMin: 0.6 },
      signoffEligible: false,
      coverage: 0.5,
    });
    expect(snapshot.stricterThanPilot).toBe(true);
    expect(snapshot.evalRunId).toBe(evalRunId);
    expect(snapshot.evalBindId).toBe(evalRunId);
    expect(snapshot.evalBindId).toContain(evalRunId);
    expect(snapshot.gate_bundle).toBe('stricter');

    const diff = compareHardGates(snapshot.gates);
    expect(diff.direction).toBe('stricter');
    expect(diff.stricterKeys).toEqual(['coverageMin']);
    expect(diff.loosenedKeys).toEqual([]);
  });

  it('equal to pilot → stricterThanPilot false, still bound to evalRunId', () => {
    const evalRunId = 'eval-run-pilot-1';
    const { snapshot } = bindQualitySnapshotToEval({
      snapshotId: 'snap-t7-eq',
      kbId: 'kb-1',
      evalRunId,
      ranAt: '2026-08-24T00:00:00.000Z',
      retrieve_mode: 'live',
      tauClaim: 0.5,
      gates: { ...PILOT_HARD_GATES },
      signoffEligible: false,
      coverage: 0.5,
    });
    expect(snapshot.stricterThanPilot).toBe(false);
    expect(snapshot.evalRunId).toBe(evalRunId);
    expect(snapshot.evalBindId).toContain(evalRunId);
    expect(compareHardGates(snapshot.gates).direction).toBe('equal');
  });

  it('剧本 T3：加严提案未绑 L1 重跑且无人签 → 只标加严、不得标「已签字」', () => {
    const { snapshot, verdict } = bindQualitySnapshotToEval({
      snapshotId: 'snap-t3',
      kbId: 'kb-1',
      evalRunId: null,
      ranAt: '2026-09-20T00:00:00.000Z',
      retrieve_mode: 'live',
      tauClaim: 0.5,
      gates: { ...PILOT_HARD_GATES, cRateMax: 0.03 },
      proposal: true,
      signoffEligible: true,
      coverage: 0.5,
      caseReasons: ['verified'],
    });

    // 加严标记本身成立（diff 变严）
    expect(snapshot.stricterThanPilot).toBe(true);
    expect(snapshot.gate_bundle).toBe('stricter');
    expect(snapshot.gates.cRateMax).toBe(0.03);

    // 但「已签字」不成立：没有 2×2 run 身份、没有人签
    expect(snapshot.evalRunId).toBeNull();
    expect(snapshot.evalBindId).toBe('report:kb-1:2026-09-20T00:00:00.000Z');
    expect(verdict.signedPackage).toBe(false);
    expect(verdict.businessPass).toBe(false);
    expect(verdict.reasons).toContain('missing_signatures');
  });
});
