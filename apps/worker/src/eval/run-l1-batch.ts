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
  judgeAurocSourceFor,
  mockJudgeScorer,
  parseMinSupport,
  sweepTau,
  type EvalRetrieveMode,
  type GoldType,
  type JudgeAurocSource,
  type JudgeCalibCase,
  type JudgeCalibScorerMode,
  type L1Cell,
  type L1Matrix,
  type L1Outcome,
  type TauSweepPoint,
  type HumanSpotReport,
  toHumanSpotReport,
} from '@strict-rag/contracts';
import {
  emptyL1Repro,
  l1QuestionIdsHash,
  type L1Repro,
} from '@strict-rag/contracts/eval-repro';

import { env } from '../env.js';

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
   * 打分器来源三态（与 api CLI 同形状 / 同一套映射）：`off` → `none`、`mock` → `mock`、`http` → `live`。
   * 判定只认 `live`，且判定只在 api 侧（worker 只落库）。
   */
  judgeAurocSource: JudgeAurocSource;
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
  /**
   * PRD §8 可复现区块：与 api CLI **同形状**（`@strict-rag/contracts/eval-repro` 的 `L1Repro`）。
   * worker 侧批跑经 api 内口执行、不持有本次 run 的模型/档位/τ 配置 → 那些分项为 `null`（记债），
   * 取不到的一律 `null`（禁止占位串）。
   */
  repro: L1Repro;
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
  /**
   * 打分器来源声明（与 api CLI 同名同义；默认读 env `JUDGE_CALIB_SCORER` = `off`）。
   * `off` → 不跑任何打分器（注入的也不跑）→ 缺测；`mock` → 内置确定性伪打分器（只打印）；
   * `http` → 用注入的真打分器（来源 `live`）。worker 侧不硬造判定点。
   */
  judgeScorerMode?: JudgeCalibScorerMode;
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
  // 来源只由声明决定（与 api `scoreJudgeAuroc` 同构，共用 `judgeAurocSourceFor`）
  const judgeScorerMode = opts.judgeScorerMode ?? env.JUDGE_CALIB_SCORER;
  const judgeAurocSource = judgeAurocSourceFor(judgeScorerMode);
  const judgeScorer =
    judgeScorerMode === 'mock'
      ? async (calib: readonly JudgeCalibCase[]) => mockJudgeScorer(calib)
      : judgeScorerMode === 'http'
        ? opts.scoreJudge
        : undefined;
  let judgeAuroc: number | null = null;
  let judgeAurocScored = 0;
  if (judgeScorer && opts.judgeCalibCases && opts.judgeCalibCases.length > 0) {
    const calib = opts.judgeCalibCases;
    const scores = await judgeScorer(calib);
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
    judgeAurocSource,
    citationComplete: citationCompleteRate(rows),
    citationCompleteDen: rows.filter(
      (r) => r.outcome === 'answered' && r.answerKind === 'knowledge',
    ).length,
    humanSpot,
    /**
     * §8 区块：worker 只填题面 ID 哈希（源 = DB `gold_questions.case_key` 全量，升序见 `l1QuestionIdsHash`）。
     * 其余分项留 `null`：模型 / 档位预算 / τ 都在 api 侧（批跑经内口执行，不回传档位）；校准集只有
     * 解析后的入参、无文件内容；seed / 版本类字段无载体。销账路径见工单 05 的去向表。
     */
    repro: {
      ...emptyL1Repro(),
      questionIdsHash: l1QuestionIdsHash(opts.cases.map((c) => c.caseKey)),
    },
    errorCount,
    cases: rows,
    kbId: opts.kbId,
  };
}
