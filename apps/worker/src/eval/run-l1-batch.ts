import {
  accumulate,
  cellFor,
  computeSignoffEligible,
  coverage,
  emptyMatrix,
  goldTypeCounts,
  type EvalRetrieveMode,
  type GoldType,
  type L1Cell,
  type L1Matrix,
  type L1Outcome,
} from '@strict-rag/contracts';

export type EvalGoldCase = {
  caseKey: string;
  question: string;
  type: GoldType;
};

export type EvalCaseExecuteResult =
  | { outcome: 'answered' | 'abstained'; reason?: string }
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
  let errorCount = 0;
  const rows: L1BatchCaseRow[] = [];

  for (const c of sliced) {
    let outcome: L1Outcome;
    let reason: string | undefined;
    let errorMessage: string | undefined;
    try {
      const result = await opts.execute({ caseKey: c.caseKey, question: c.question });
      outcome = result.outcome;
      if (result.outcome === 'error') {
        errorMessage = result.errorMessage;
      } else {
        reason = result.reason;
      }
    } catch (err) {
      outcome = 'error';
      errorMessage = err instanceof Error ? err.message : String(err);
    }
    errorCount += accumulate(matrix, c.type, outcome);
    rows.push({
      id: c.caseKey,
      type: c.type,
      outcome,
      cell: cellFor(c.type, outcome),
      reason,
      errorMessage,
    });
  }

  const counts = goldTypeCounts(sliced);
  const retrieveMode = opts.retrieveMode;
  return {
    retrieveMode,
    signoffEligible: computeSignoffEligible(retrieveMode, counts),
    ranAt: (opts.now ?? (() => new Date()))().toISOString(),
    caseCount: sliced.length,
    answerableCount: counts.answerable,
    unanswerableClassCount: counts.unanswerableClass,
    matrix,
    coverage: coverage(matrix),
    errorCount,
    cases: rows,
    kbId: opts.kbId,
  };
}
