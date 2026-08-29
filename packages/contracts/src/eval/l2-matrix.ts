/**
 * L2 机械分与工程 signoffEligible（≠ 准出 PASS / ≠ 人签）。
 */
import type { EvalRetrieveMode } from './l1-matrix.js';
import {
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
 * live ∧ 九类齐 ∧ 零容忍机械项=0 ∧ 题量≥15。
 * mock / unknown / 截断 / 缺类 / 历史泄漏 → false。仍 ≠ 人签。
 */
export function computeL2SignoffEligible(input: {
  retrieveMode: EvalRetrieveMode;
  cases: ReadonlyArray<{ type: L2Type }>;
  caseCount: number;
  zeroToleranceHits: number;
}): boolean {
  if (input.retrieveMode !== 'live') return false;
  if (input.caseCount < L2_SIGNOFF_MIN_CASES) return false;
  if (input.zeroToleranceHits !== 0) return false;
  return l2TypeCoverage(input.cases).missing.length === 0;
}
