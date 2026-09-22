/**
 * ADR-046：质量配置快照 + 硬门单向校验 + 四要素 / 业务 PASS 闸。
 * 绑定现有 L1 eval 身份；不另开 ask 图。≠ 人签、≠ 业务 PASS。
 *
 * 实测硬门进闸（L1 侧）：coverage / cRate / hitAtK / judgeAuroc / citationComplete / humanSpot 由
 * L1 runner 实测（抽检为文件账本登记）后传进 `evaluateAdr046Bind` 的 `&&`。缺测 null 一律
 * **不放行**（fail-closed），唯二例外是 PRD 写了条件语的两门：hitAt20「有标注时」（无标注 →
 * 该门不适用）与 citationComplete（无 knowledge answered 题 → 分母 0 → 不适用）。任何加法都只许
 * 加严，禁止放宽既有判定。
 *
 * `judgeAuroc` 在生产入口今天恒为 null（CLI `main()` 不传 `scoreJudge`、worker consumer 同），
 * 故 `businessPass` 在生产路径上**不可达**。这是有意的 —— 把「未测」显形为红，而不是留一条
 * 覆盖率 0.001 也能变真的假绿。judgeAuroc 有生产者路径（可注入校准打分器），缺的是接线。
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

/**
 * 人工抽检登记值（来自文件账本；见 `eval/human-spot.ts`）。
 * 「错」的口径由抽检人按 rubric 判，判定侧只比两个整数与 `PILOT_HARD_GATES`。
 */
export type HumanSpotCounts = { checked: number; errors: number };

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
  /** C 率实测 C/(C+D)；缺测 null → 不放行 */
  cRate?: number | null;
  /** Hit@k 实测；无标注题 → null → 该门不适用（PRD「有标注时」） */
  hitAtK?: number | null;
  /** Judge AUROC 实测；缺接线 → null → 不放行（缺测显形为红） */
  judgeAuroc?: number | null;
  /** 引用完整率实测；分母 0 → null → 该门不适用 */
  citationComplete?: number | null;
  /** 人工抽检账本条数/错数；未登记账本 → null → 不放行（缺测显形为红） */
  humanSpot?: HumanSpotCounts | null;
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
  cRate?: number | null;
  hitAtK?: number | null;
  judgeAuroc?: number | null;
  citationComplete?: number | null;
  humanSpot?: HumanSpotCounts | null;
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

  // 门限一律读 PILOT_HARD_GATES，禁止在判定处写裸数字
  const gates = PILOT_HARD_GATES;
  // 覆盖率：> 0 的口径已废（0.001 也能变真）→ >= coverageMin；null / 0 沿用旧 code 语义
  const coverageOk = input.coverage != null && input.coverage >= gates.coverageMin;
  if (input.coverage == null || input.coverage <= 0) reasons.push('coverage_zero_or_null');
  else if (!coverageOk) reasons.push('coverage_below_min');
  // C 率：缺测 null 不放行
  const cRateOk = input.cRate != null && input.cRate <= gates.cRateMax;
  if (!cRateOk) reasons.push('c_rate_missing_or_above_max');
  // Hit@k：null = 无标注 = 该门不适用（PRD「有标注时」）
  const hitAtKOk = input.hitAtK == null || input.hitAtK >= gates.hitAt20Min;
  if (!hitAtKOk) reasons.push('hit_at_k_below_min');
  // Judge AUROC：null 不放行（把「未测」显形为红）
  const judgeAurocOk = input.judgeAuroc != null && input.judgeAuroc >= gates.judgeAurocMin;
  if (!judgeAurocOk) reasons.push('judge_auroc_missing_or_below_min');
  // 引用完整率：分母 0 的题集 → null → 该门不适用
  const citationCompleteOk =
    input.citationComplete == null || input.citationComplete >= gates.citationCompleteMin;
  if (!citationCompleteOk) reasons.push('citation_complete_below_min');
  // 人工抽检（PRD §6 硬门「≥20 条，错 ≤1」）：没登记账本 = 缺测 → 不放行；
  // 条数不足与错超限是两种红，各自可分辨（两者可同时成立 → 同时报）
  const humanSpot = input.humanSpot ?? null;
  const humanSpotOk =
    humanSpot != null &&
    humanSpot.checked >= gates.humanSpotMin &&
    humanSpot.errors <= gates.humanSpotErrorMax;
  if (humanSpot == null) reasons.push('human_spot_missing');
  else if (!humanSpotOk) {
    if (humanSpot.checked < gates.humanSpotMin) reasons.push('human_spot_below_min');
    if (humanSpot.errors > gates.humanSpotErrorMax) reasons.push('human_spot_errors_above_max');
  }

  if (!input.signoffEligible) reasons.push('not_signoff_eligible');
  if (allInternalGuard(input.caseReasons)) reasons.push('internal_guard');

  const businessPass =
    signedPackage &&
    input.signoffEligible &&
    coverageOk &&
    cRateOk &&
    hitAtKOk &&
    judgeAurocOk &&
    citationCompleteOk &&
    humanSpotOk &&
    !allInternalGuard(input.caseReasons);

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
    cRate: input.cRate ?? null,
    hitAtK: input.hitAtK ?? null,
    judgeAuroc: input.judgeAuroc ?? null,
    citationComplete: input.citationComplete ?? null,
    humanSpot: input.humanSpot ?? null,
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
