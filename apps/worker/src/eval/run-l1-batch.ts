import {
  accumulate,
  accumulateHitAtK,
  cellFor,
  citationCompleteRate,
  computeSignoffEligible,
  coverage,
  emptyHitAtK,
  emptyMatrix,
  goldTypeCounts,
  hitAtKCase,
  hitAtKRate,
  judgeAurocFromScored,
  parseMinSupport,
  sweepTau,
  type EvalRetrieveMode,
  type GoldType,
  type JudgeCalibCase,
  type L1Cell,
  type L1Matrix,
  type L1Outcome,
  type TauSweepPoint,
  type HumanSpotReport,
  toHumanSpotReport,
} from '@strict-rag/contracts';

import { loadHumanSpotLedger } from './human-spot.js';

export type EvalGoldCase = {
  caseKey: string;
  question: string;
  type: GoldType;
  expectedDocIds?: string[] | null;
};

export type EvalCaseExecuteResult =
  | {
      outcome: 'answered' | 'abstained';
      reason?: string;
      evidenceDocIds?: string[];
      minSupport?: number | null;
      /** 图上 answerKind；未采集 → 缺省（该题不进引用完整率分母） */
      answerKind?: 'knowledge' | 'chitchat';
      /** 图上 citations.length；未采集 → 缺省 */
      citationCount?: number;
    }
  | { outcome: 'error'; errorMessage?: string };

export type EvalCaseExecute = (input: {
  caseKey: string;
  question: string;
}) => Promise<EvalCaseExecuteResult>;

export type L1BatchCaseRow = {
  id: string;
  type: GoldType;
  outcome: L1Outcome;
  cell: L1Cell | null;
  reason?: string;
  errorMessage?: string;
  hitAtK?: boolean | null;
  minSupport?: number | null;
  /** 图上的答案域；拒答 / error / 未采集无该字段 */
  answerKind?: 'knowledge' | 'chitchat';
  /** 图上 citations.length；未采集 → 缺省 */
  citationCount?: number;
};

export type L1BatchReport = {
  retrieveMode: EvalRetrieveMode;
  signoffEligible: boolean;
  ranAt: string;
  caseCount: number;
  answerableCount: number;
  unanswerableClassCount: number;
  matrix: L1Matrix;
  coverage: number | null;
  hitAtK: number | null;
  hitAtKHits: number;
  hitAtKScored: number;
  tauStar: number | null;
  tauSweep: TauSweepPoint[];
  judgeAuroc: number | null;
  judgeAurocScored: number;
  /**
   * 引用完整率：分子 = answerKind='knowledge' ∧ outcome='answered' ∧ citations>0；
   * 分母 = answerKind='knowledge' ∧ outcome='answered'；分母 0 → null（该门不适用）。
   * 图在 answered ∧ knowledge 时结构上必带合法 citation（graph/run.ts validIds 闸），
   * 故本率结构上只能是 1 或 null —— 此门钉的是该不变式，不是筛掉不合格跑次。
   */
  citationComplete: number | null;
  /** 引用完整率分母（knowledge ∧ answered 题数） */
  citationCompleteDen: number;
  /** 人工抽检（PRD §6 硬门）：账本登记的条数 / 错数 / 来源；缺测 → null（= 没人登记） */
  humanSpot: HumanSpotReport | null;
  errorCount: number;
  cases: L1BatchCaseRow[];
  kbId: string;
};

export async function runL1Batch(opts: {
  kbId: string;
  cases: readonly EvalGoldCase[];
  retrieveMode: EvalRetrieveMode;
  execute: EvalCaseExecute;
  maxCases?: number;
  now?: () => Date;
  judgeCalibCases?: readonly JudgeCalibCase[];
  scoreJudge?: (cases: readonly JudgeCalibCase[]) => Promise<Array<number | null>>;
  /** 人工抽检账本路径（与 api CLI `--human-spot <path>` 同构）；**不传 = 缺测** */
  humanSpotPath?: string;
}): Promise<L1BatchReport> {
  const humanSpot = opts.humanSpotPath
    ? toHumanSpotReport(loadHumanSpotLedger(opts.humanSpotPath), opts.humanSpotPath)
    : null;
  const sliced =
    opts.maxCases && opts.maxCases > 0 ? opts.cases.slice(0, opts.maxCases) : opts.cases;
  const matrix = emptyMatrix();
  const hitAcc = emptyHitAtK();
  let errorCount = 0;
  const rows: L1BatchCaseRow[] = [];

  for (const c of sliced) {
    let outcome: L1Outcome;
    let reason: string | undefined;
    let errorMessage: string | undefined;
    let evidenceDocIds: string[] = [];
    let minSupport: number | null = null;
    let answerKind: 'knowledge' | 'chitchat' | undefined;
    let citationCount: number | undefined;
    try {
      const result = await opts.execute({ caseKey: c.caseKey, question: c.question });
      outcome = result.outcome;
      if (result.outcome === 'error') {
        errorMessage = result.errorMessage;
      } else {
        reason = result.reason;
        evidenceDocIds = result.evidenceDocIds ?? [];
        minSupport = parseMinSupport(result.minSupport);
        answerKind = result.answerKind;
        citationCount = result.citationCount;
      }
    } catch (err) {
      outcome = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    errorCount += accumulate(matrix, c.type, outcome);
    const hit = hitAtKCase(c.expectedDocIds, evidenceDocIds);
    accumulateHitAtK(hitAcc, hit);
    rows.push({
      id: c.caseKey,
      type: c.type,
      outcome,
      cell: cellFor(c.type, outcome),
      reason,
      errorMessage,
      hitAtK: hit,
      minSupport,
      answerKind,
      citationCount,
    });
  }

  const counts = goldTypeCounts(sliced);
  const retrieveMode = opts.retrieveMode;
  const swept = sweepTau(rows);
  let judgeAuroc: number | null = null;
  let judgeAurocScored = 0;
  if (opts.scoreJudge && opts.judgeCalibCases && opts.judgeCalibCases.length > 0) {
    const calib = opts.judgeCalibCases;
    const scores = await opts.scoreJudge(calib);
    if (scores.length !== calib.length) {
      throw new Error(
        `scoreJudge length ${scores.length} !== calibration cases ${calib.length}`,
      );
    }
    const scored = judgeAurocFromScored(
      calib.map((c, i) => ({ label: c.label, score: scores[i] })),
    );
    judgeAuroc = scored.auroc;
    judgeAurocScored = scored.scored;
  }
  return {
    retrieveMode,
    signoffEligible: computeSignoffEligible(retrieveMode, counts),
    ranAt: (opts.now ?? (() => new Date()))().toISOString(),
    caseCount: sliced.length,
    answerableCount: counts.answerable,
    unanswerableClassCount: counts.unanswerableClass,
    matrix,
    coverage: coverage(matrix),
    hitAtK: hitAtKRate(hitAcc),
    hitAtKHits: hitAcc.hits,
    hitAtKScored: hitAcc.scored,
    tauStar: swept.tauStar,
    tauSweep: swept.grid,
    judgeAuroc,
    judgeAurocScored,
    citationComplete: citationCompleteRate(rows),
    citationCompleteDen: rows.filter(
      (r) => r.outcome === 'answered' && r.answerKind === 'knowledge',
    ).length,
    humanSpot,
    errorCount,
    cases: rows,
    kbId: opts.kbId,
  };
}
