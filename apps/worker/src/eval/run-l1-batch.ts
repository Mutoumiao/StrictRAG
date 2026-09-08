import {
  accumulate,
  accumulateHitAtK,
  cellFor,
  computeSignoffEligible,
  coverage,
  emptyHitAtK,
  emptyMatrix,
  goldTypeCounts,
  hitAtKCase,
  hitAtKRate,
  parseMinSupport,
  sweepTau,
  type EvalRetrieveMode,
  type GoldType,
  type L1Cell,
  type L1Matrix,
  type L1Outcome,
  type TauSweepPoint,
} from '@strict-rag/contracts';

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
}): Promise<L1BatchReport> {
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
    try {
      const result = await opts.execute({ caseKey: c.caseKey, question: c.question });
      outcome = result.outcome;
      if (result.outcome === 'error') {
        errorMessage = result.errorMessage;
      } else {
        reason = result.reason;
        evidenceDocIds = result.evidenceDocIds ?? [];
        minSupport = parseMinSupport(result.minSupport);
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
    });
  }

  const counts = goldTypeCounts(sliced);
  const retrieveMode = opts.retrieveMode;
  const swept = sweepTau(rows);
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
    errorCount,
    cases: rows,
    kbId: opts.kbId,
  };
}
