import {
  acceptHit,
  computeL2SignoffEligible,
  historyLeaked,
  nextSessionId,
  type EvalRetrieveMode,
  type L2Case,
  type L2Type,
} from '@strict-rag/contracts';
import { uuidv7 } from 'uuidv7';

export type L2Verdict = 'pass' | 'fail' | 'error';

export type L2TurnExecuteResult =
  | {
      outcome: 'answered' | 'abstained';
      reason?: string;
      rewriteUsed?: boolean;
      evidenceTexts?: string[];
      answer?: string;
    }
  | { outcome: 'error'; errorMessage?: string };

export type L2TurnExecute = (input: {
  question: string;
  sessionId?: string;
  sessionWindow: { role: 'user' | 'assistant'; content: string }[];
}) => Promise<L2TurnExecuteResult>;

export type L2BatchCaseRow = {
  id: string;
  type: L2Type;
  verdict: L2Verdict;
  lastStatus?: string;
  lastReason?: string;
  rewriteUsed?: boolean;
  historyInEvidence: boolean;
  expectedThemePersist: boolean;
  failReasons: string[];
  errorMessage?: string;
};

export type L2BatchReport = {
  run_type: 'session_multiturn';
  retrieveMode: EvalRetrieveMode;
  signoffEligible: boolean;
  ranAt: string;
  kbId: string;
  caseCount: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  zeroToleranceHits: number;
  cases: L2BatchCaseRow[];
};

type WindowTurn = { role: 'user' | 'assistant'; content: string };

export async function runL2Batch(opts: {
  kbId: string;
  cases: readonly L2Case[];
  retrieveMode: EvalRetrieveMode;
  executeTurn: L2TurnExecute;
  maxCases?: number;
  mintSessionId?: () => string;
  now?: () => Date;
}): Promise<L2BatchReport> {
  const sliced =
    opts.maxCases && opts.maxCases > 0 ? opts.cases.slice(0, opts.maxCases) : opts.cases;
  const mint = opts.mintSessionId ?? (() => uuidv7());
  const windows = new Map<string, WindowTurn[]>();
  const rows: L2BatchCaseRow[] = [];
  let passCount = 0;
  let failCount = 0;
  let errorCount = 0;
  let zeroToleranceHits = 0;

  for (const c of sliced) {
    let prev: string | null = null;
    let last: Extract<L2TurnExecuteResult, { outcome: 'answered' | 'abstained' }> | undefined;
    try {
      for (const turn of c.turns) {
        const sessionId = nextSessionId(turn.session, prev, mint);
        if (sessionId !== undefined) prev = sessionId;
        const window = sessionId ? (windows.get(sessionId) ?? []) : [];
        const result = await opts.executeTurn({
          question: turn.text,
          sessionId,
          sessionWindow: window,
        });
        if (result.outcome === 'error') {
          throw new Error(result.errorMessage ?? 'execute-ask error');
        }
        last = result;
        if (sessionId) {
          const hist = windows.get(sessionId) ?? [];
          hist.push({ role: 'user', content: turn.text });
          if (result.answer) hist.push({ role: 'assistant', content: result.answer });
          windows.set(sessionId, hist);
        }
      }

      const evidenceTexts = last?.evidenceTexts ?? [];
      const priorUserTexts = c.turns.slice(0, -1).map((t) => t.text);
      const leaked = historyLeaked(evidenceTexts, priorUserTexts);
      const failReasons: string[] = [];
      if (leaked) failReasons.push('history_in_evidence');
      if (!acceptHit(c.expected.accept, last?.outcome ?? '', last?.reason)) {
        failReasons.push('accept');
      }
      if ((last?.rewriteUsed ?? false) !== c.expected.rewriteUsed) {
        failReasons.push('rewriteUsed');
      }

      const verdict: L2Verdict = failReasons.length ? 'fail' : 'pass';
      if (leaked) zeroToleranceHits += 1;
      if (verdict === 'pass') passCount += 1;
      else failCount += 1;

      rows.push({
        id: c.id,
        type: c.type,
        verdict,
        lastStatus: last?.outcome,
        lastReason: last?.reason,
        rewriteUsed: last?.rewriteUsed,
        historyInEvidence: leaked,
        expectedThemePersist: c.expected.themePersist,
        failReasons,
      });
    } catch (err) {
      errorCount += 1;
      rows.push({
        id: c.id,
        type: c.type,
        verdict: 'error',
        historyInEvidence: false,
        expectedThemePersist: c.expected.themePersist,
        failReasons: [],
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    run_type: 'session_multiturn',
    retrieveMode: opts.retrieveMode,
    signoffEligible: computeL2SignoffEligible({
      retrieveMode: opts.retrieveMode,
      cases: sliced,
      caseCount: rows.length,
      zeroToleranceHits,
    }),
    ranAt: (opts.now ?? (() => new Date()))().toISOString(),
    kbId: opts.kbId,
    caseCount: rows.length,
    passCount,
    failCount,
    errorCount,
    zeroToleranceHits,
    cases: rows,
  };
}
