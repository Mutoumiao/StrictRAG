import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { L2GoldLoadError, parseExpectedDocIds, parseL2Gold, type L2Case } from '@strict-rag/contracts';
import { evalRuns, formatLocalDateTime, goldQuestions } from '@strict-rag/db';
import { eq } from 'drizzle-orm';

import { env } from '../env.js';
import { getDb } from '../db.js';
import type { EvalGoldCase } from './run-l1-batch.js';
import type { L1BatchReport } from './run-l1-batch.js';
import type { L2BatchReport } from './run-l2-batch.js';

function asGoldType(raw: string): EvalGoldCase['type'] | null {
  if (raw === 'answerable' || raw === 'unanswerable' || raw === 'false_premise') return raw;
  return null;
}

export type EvalPersist = {
  loadGold(kbId: string): Promise<EvalGoldCase[]>;
  loadL2Cases(): Promise<L2Case[]>;
  markRunning(runId: string): Promise<void>;
  markFailed(runId: string, message: string): Promise<void>;
  saveReport(runId: string, report: L1BatchReport): Promise<void>;
  saveL2Report(runId: string, report: L2BatchReport): Promise<void>;
};

function defaultL2GoldPath(): string {
  if (env.EVAL_L2_GOLD_PATH) return env.EVAL_L2_GOLD_PATH;
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
  return path.join(repoRoot, 'fixtures/l2/gold.yaml');
}

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
      let expectedDocIds: string[] | null;
      try {
        expectedDocIds = parseExpectedDocIds(r.expectedDocIds);
      } catch (err) {
        throw new Error(
          `gold ${r.caseKey} expectedDocIds ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      out.push({
        caseKey: r.caseKey,
        question: r.question,
        type,
        expectedDocIds,
      });
    }
    return out;
  },

  async loadL2Cases() {
    const goldPath = defaultL2GoldPath();
    let raw: string;
    try {
      raw = readFileSync(goldPath, 'utf8');
    } catch (err) {
      throw new L2GoldLoadError(`cannot read gold file: ${goldPath}: ${(err as Error).message}`);
    }
    try {
      return parseL2Gold(JSON.parse(raw)).cases;
    } catch (err) {
      if (err instanceof L2GoldLoadError) throw err;
      throw new L2GoldLoadError(`invalid gold JSON in ${goldPath}: ${(err as Error).message}`);
    }
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
          hitAtK: report.hitAtK,
          hitAtKHits: report.hitAtKHits,
          hitAtKScored: report.hitAtKScored,
          tauStar: report.tauStar,
          tauSweep: report.tauSweep,
          judgeAuroc: report.judgeAuroc,
          judgeAurocScored: report.judgeAurocScored,
          errorCount: report.errorCount,
          cases: report.cases,
          kbId: report.kbId,
        },
      })
      .where(eq(evalRuns.id, runId));
  },

  async saveL2Report(runId, report) {
    await getDb()
      .update(evalRuns)
      .set({
        status: 'succeeded',
        retrieveMode: report.retrieveMode,
        signoffEligible: report.signoffEligible ? '1' : '0',
        caseCount: report.caseCount,
        matrixA: 0,
        matrixB: 0,
        matrixC: 0,
        matrixD: 0,
        coverage: null,
        errorCount: report.errorCount,
        ranAt: evalRunDbRanAt(report.ranAt),
        errorMessage: null,
        reportJson: {
          run_type: report.run_type,
          retrieve_mode: report.retrieveMode,
          signoffEligible: report.signoffEligible,
          ranAt: report.ranAt,
          caseCount: report.caseCount,
          passCount: report.passCount,
          failCount: report.failCount,
          errorCount: report.errorCount,
          zeroToleranceHits: report.zeroToleranceHits,
          cases: report.cases,
          kbId: report.kbId,
        },
      })
      .where(eq(evalRuns.id, runId));
  },
};
