/**
 * L2 机械分与工程 signoffEligible（≠ 准出 PASS / ≠ 人签）。
 */
import type { EvalRetrieveMode } from './l1-matrix.js';
import {
  L2_NEAR_COREF_PASS_MIN,
  L2_SIGNOFF_MIN_CASES,
  l2TypeCoverage,
  type L2Accept,
  type L2SessionRef,
  type L2Type,
} from './l2-gold.js';

export function nextSessionId(
  ref: L2SessionRef,
  prev: string | null,
  mint: () => string,
): string | undefined {
  if (ref === 'none') return undefined;
  if (ref === 'new' || !prev) return mint();
  return prev;
}

export function acceptHit(accept: readonly L2Accept[], status: string, reason?: string): boolean {
  return accept.some((a) => a === status || a === reason);
}

export function historyLeaked(
  evidenceTexts: readonly string[],
  priorUserTexts: readonly string[],
): boolean {
  return priorUserTexts.some((q) => q && evidenceTexts.some((t) => t.includes(q)));
}

/**
 * 近指代（near_coref）题的机械 pass 比例：分子 = `type='near_coref' ∧ verdict='pass'`；
 * 分母 = **全部** `near_coref` 行（**含 `error`**，error 不算 pass）；分母 0 → `null`。
 *
 * `error` 进分母的理由：把它排除会让「全批 error」退化成 `null` → 分母 0 → 该门不适用 →
 * 放行（fail-open）；本仓纪律是「无有效数据不外推」（与 `sweepTau` 的 `scored=0 → tauStar=null` 同款）。
 *
 * 残余（不许省）：① 本率**不含**「主题是否正确」——今天无 judge，且 L2 runner 未采集
 * `evidence_snapshot.docId`，连按 `expectedDocIds` 判命中都做不到；② **不含**「合法 citation」；
 * ③ 仓库夹具只有 3 条 `near_coref`，80% 只能取 0 / 33.3 / 66.7 / 100%，故今天该门等价于
 * 「3/3 全过」而非比例门（夹具债另记）。api CLI 与 worker eval 消费者共用，禁止单边另写一份口径。
 */
export function l2NearCorefPassRate(
  rows: ReadonlyArray<{ type: L2Type; verdict: string }>,
): number | null {
  let num = 0;
  let den = 0;
  for (const r of rows) {
    if (r.type !== 'near_coref') continue;
    den += 1;
    if (r.verdict === 'pass') num += 1;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ 题量≥15 ∧ 近指代通过率≥80%。
 * mock / unknown / 截断 / 缺类 / 历史泄漏 / 近指代率缺测(null) / 近指代率不足 → false。仍 ≠ 人签。
 *
 * 近指代率的口径与残余见 `l2NearCorefPassRate`：它只等价于「近指代题的机械 pass 比例」，
 * 不含主题是否正确、不含合法 citation；夹具只有 3 条 near_coref，故今天该门 ≈「3/3 全过」。
 */
export function computeL2SignoffEligible(input: {
  retrieveMode: EvalRetrieveMode;
  cases: ReadonlyArray<{ type: L2Type }>;
  caseCount: number;
  zeroToleranceHits: number;
  /** 缺测（无 near_coref 题 → null）不放行；见 `l2NearCorefPassRate` 的残余说明 */
  nearCorefPassRate: number | null;
}): boolean {
  if (input.retrieveMode !== 'live') return false;
  if (input.caseCount < L2_SIGNOFF_MIN_CASES) return false;
  if (input.zeroToleranceHits !== 0) return false;
  const nearCorefOk =
    input.nearCorefPassRate !== null && input.nearCorefPassRate >= L2_NEAR_COREF_PASS_MIN;
  if (!nearCorefOk) return false;
  return l2TypeCoverage(input.cases).missing.length === 0;
}
