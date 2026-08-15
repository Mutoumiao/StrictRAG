/**
 * ADR-046：质量配置快照 + 硬门单向校验 + 四要素 / 业务 PASS 闸。
 * 绑定现有 L1 eval 身份；不另开 ask 图。≠ 人签、≠ 业务 PASS。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/** 试点默认硬门（prds/08-quality/02 §6） */
export const PILOT_HARD_GATES = {
  cRateMax: 0.05,
  coverageMin: 0.4,
  citationCompleteMin: 0.99,
  judgeAurocMin: 0.65,
  hitAt20Min: 0.7,
  humanSpotMin: 20,
  humanSpotErrorMax: 1,
} as const;

export type HardGateKey = keyof typeof PILOT_HARD_GATES;
export type HardGates = Record<HardGateKey, number>;
export type GateBundle = 'pilot' | 'stricter';
export type RetrieveMode = 'mock' | 'live' | 'unknown';

/** 上限类：数值越小越严 */
const MAX_KEYS = new Set<HardGateKey>(['cRateMax', 'humanSpotErrorMax']);

export type GateDiff = {
  loosenedKeys: HardGateKey[];
  stricterKeys: HardGateKey[];
  direction: 'equal' | 'stricter' | 'looser';
};

export type FourElements = {
  proposal: boolean;
  l1RerunBound: boolean;
  signatures: boolean;
  configSnapshot: boolean;
};

export type Adr046Snapshot = {
  snapshotId: string;
  kbId: string;
  evalRunId: string | null;
  evalBindId: string;
  retrieve_mode: RetrieveMode;
  tauClaim: number;
  gate_bundle: GateBundle;
  gates: HardGates;
  fourElements: FourElements;
  stricterThanPilot: boolean;
  loosenedKeys: HardGateKey[];
};

export type BindVerdict = {
  bindable: boolean;
  signedPackage: boolean;
  businessPass: boolean;
  reasons: string[];
};

export type BindSnapshotInput = {
  snapshotId: string;
  kbId: string;
  evalRunId?: string | null;
  ranAt: string;
  retrieve_mode: RetrieveMode;
  tauClaim: number;
  gates?: HardGates;
  proposal?: boolean;
  businessR?: boolean;
  productA?: boolean;
  signoffEligible: boolean;
  coverage: number | null;
  caseReasons?: Array<string | undefined>;
};

export function snapshotBindIdentity(input: {
  evalRunId?: string | null;
  kbId: string;
  ranAt: string;
}): string {
  return input.evalRunId ? input.evalRunId : `report:${input.kbId}:${input.ranAt}`;
}

export function compareHardGates(
  candidate: HardGates,
  pilot: HardGates = PILOT_HARD_GATES,
): GateDiff {
  const loosenedKeys: HardGateKey[] = [];
  const stricterKeys: HardGateKey[] = [];
  for (const key of Object.keys(pilot) as HardGateKey[]) {
    const c = candidate[key];
    const p = pilot[key];
    if (c === p) continue;
    const looser = MAX_KEYS.has(key) ? c > p : c < p;
    if (looser) loosenedKeys.push(key);
    else stricterKeys.push(key);
  }
  let direction: GateDiff['direction'] = 'equal';
  if (loosenedKeys.length > 0) direction = 'looser';
  else if (stricterKeys.length > 0) direction = 'stricter';
  return { loosenedKeys, stricterKeys, direction };
}

export function isStricterThanPilot(gates: HardGates): boolean {
  return compareHardGates(gates).direction === 'stricter';
}

function gatesComplete(gates: HardGates): boolean {
  for (const key of Object.keys(PILOT_HARD_GATES) as HardGateKey[]) {
    if (typeof gates[key] !== 'number' || !Number.isFinite(gates[key])) return false;
  }
  return true;
}

export function fourElementsOf(input: {
  kbId: string;
  tauClaim: number;
  gates: HardGates;
  evalRunId?: string | null;
  ranAt: string;
  proposal?: boolean;
  businessR?: boolean;
  productA?: boolean;
}): FourElements {
  const tauOk = Number.isFinite(input.tauClaim) && input.tauClaim >= 0 && input.tauClaim <= 1;
  return {
    proposal: input.proposal === true,
    l1RerunBound: Boolean(input.evalRunId) || Boolean(input.kbId && input.ranAt),
    signatures: input.businessR === true && input.productA === true,
    configSnapshot: Boolean(input.kbId) && tauOk && gatesComplete(input.gates),
  };
}

export function fourElementsComplete(el: FourElements): boolean {
  return el.proposal && el.l1RerunBound && el.signatures && el.configSnapshot;
}

export function allInternalGuard(reasons: Array<string | undefined> | undefined): boolean {
  if (!reasons || reasons.length === 0) return false;
  const known = reasons.filter((r): r is string => typeof r === 'string' && r.length > 0);
  return known.length > 0 && known.every((r) => r === 'internal_guard');
}

export function evaluateAdr046Bind(input: {
  four: FourElements;
  diff: GateDiff;
  signoffEligible: boolean;
  coverage: number | null;
  caseReasons?: Array<string | undefined>;
}): BindVerdict {
  const reasons: string[] = [];
  const bindable = input.four.configSnapshot && input.four.l1RerunBound;
  if (!input.four.configSnapshot) reasons.push('missing_config_snapshot');
  if (!input.four.l1RerunBound) reasons.push('missing_eval_bind');
  if (!input.four.proposal) reasons.push('missing_proposal');
  if (!input.four.signatures) reasons.push('missing_signatures');
  if (input.diff.direction === 'looser') reasons.push('loosened_hard_gate');

  const signedPackage =
    fourElementsComplete(input.four) && input.diff.direction !== 'looser';

  const coverageOk = input.coverage != null && input.coverage > 0;
  if (!input.signoffEligible) reasons.push('not_signoff_eligible');
  if (!coverageOk) reasons.push('coverage_zero_or_null');
  if (allInternalGuard(input.caseReasons)) reasons.push('internal_guard');

  const businessPass =
    signedPackage && input.signoffEligible && coverageOk && !allInternalGuard(input.caseReasons);

  return { bindable, signedPackage, businessPass, reasons };
}

/** 已交付入口：构造快照并给出绑定裁决（纯函数，无 I/O） */
export function bindQualitySnapshotToEval(input: BindSnapshotInput): {
  snapshot: Adr046Snapshot;
  verdict: BindVerdict;
} {
  const gates: HardGates = { ...(input.gates ?? PILOT_HARD_GATES) };
  const diff = compareHardGates(gates);
  const four = fourElementsOf({
    kbId: input.kbId,
    tauClaim: input.tauClaim,
    gates,
    evalRunId: input.evalRunId,
    ranAt: input.ranAt,
    proposal: input.proposal,
    businessR: input.businessR,
    productA: input.productA,
  });
  const verdict = evaluateAdr046Bind({
    four,
    diff,
    signoffEligible: input.signoffEligible,
    coverage: input.coverage,
    caseReasons: input.caseReasons,
  });
  const snapshot: Adr046Snapshot = {
    snapshotId: input.snapshotId,
    kbId: input.kbId,
    evalRunId: input.evalRunId ?? null,
    evalBindId: snapshotBindIdentity({
      evalRunId: input.evalRunId,
      kbId: input.kbId,
      ranAt: input.ranAt,
    }),
    retrieve_mode: input.retrieve_mode,
    tauClaim: input.tauClaim,
    gate_bundle: diff.direction === 'stricter' ? 'stricter' : 'pilot',
    gates,
    fourElements: four,
    stricterThanPilot: diff.direction === 'stricter',
    loosenedKeys: diff.loosenedKeys,
  };
  return { snapshot, verdict };
}

export function writeBoundSnapshot(
  outDir: string,
  snapshot: Adr046Snapshot,
  verdict: BindVerdict,
): { jsonPath: string } {
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'l1-gate-snapshot.json');
  writeFileSync(jsonPath, `${JSON.stringify({ snapshot, verdict }, null, 2)}\n`, 'utf8');
  return { jsonPath };
}
