import { evalRuns, formatLocalDateTime, goldQuestions } from '@strict-rag/db';
import { eq } from 'drizzle-orm';

import { getDb } from '../db.js';
import type { EvalGoldCase } from './run-l1-batch.js';
import type { L1BatchReport } from './run-l1-batch.js';

function asGoldType(raw: string): EvalGoldCase['type'] | null {
  if (raw === 'answerable' || raw === 'unanswerable' || raw === 'false_premise') return raw;
  return null;
}

export type EvalPersist = {
  loadGold(kbId: string): Promise<EvalGoldCase[]>;
  markRunning(runId: string): Promise<void>;
  markFailed(runId: string, message: string): Promise<void>;
  saveReport(runId: string, report: L1BatchReport): Promise<void>;
};

function evalRunDbRanAt(ranAtIso: string): string {
  const d = new Date(ranAtIso);
  return formatLocalDateTime(Number.isNaN(d.getTime()) ? new Date() : d);
}

export const evalPersist: EvalPersist = {
  async loadGold(kbId) {
    const rows = await getDb()
      .select()
      .from(goldQuestions)
      .where(eq(goldQuestions.kbId, kbId));
    const out: EvalGoldCase[] = [];
    for (const r of rows) {
      const type = asGoldType(r.type);
      if (!type) continue;
      out.push({ caseKey: r.caseKey, question: r.question, type });
    }
    return out;
  },

  async markRunning(runId) {
    await getDb()
      .update(evalRuns)
      .set({ status: 'running' })
      .where(eq(evalRuns.id, runId));
  },

  async markFailed(runId, message) {
    await getDb()
      .update(evalRuns)
      .set({
        status: 'failed',
        errorMessage: message.slice(0, 2000),
        ranAt: formatLocalDateTime(),
      })
      .where(eq(evalRuns.id, runId));
  },

  async saveReport(runId, report) {
    await getDb()
      .update(evalRuns)
      .set({
        status: 'succeeded',
        retrieveMode: report.retrieveMode,
        signoffEligible: report.signoffEligible ? '1' : '0',
        caseCount: report.caseCount,
        matrixA: report.matrix.A,
        matrixB: report.matrix.B,
        matrixC: report.matrix.C,
        matrixD: report.matrix.D,
        coverage: report.coverage,
        errorCount: report.errorCount,
        ranAt: evalRunDbRanAt(report.ranAt),
        errorMessage: null,
        reportJson: {
          mode: report.retrieveMode,
          retrieve_mode: report.retrieveMode,
          signoffEligible: report.signoffEligible,
          ranAt: report.ranAt,
          caseCount: report.caseCount,
          answerableCount: report.answerableCount,
          unanswerableClassCount: report.unanswerableClassCount,
          matrix: report.matrix,
          coverage: report.coverage,
          errorCount: report.errorCount,
          cases: report.cases,
          kbId: report.kbId,
        },
      })
      .where(eq(evalRuns.id, runId));
  },
};
