import {
  type EvalRetrieveMode,
  type EvalRun,
  type EvalRunCaseRow,
  type EvalRunStatus,
  type EvalRunType,
  type L1MatrixDto,
} from '@strict-rag/contracts';
import { evalRuns, formatLocalDateTime } from '@strict-rag/db';
import { and, desc, eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { getDb } from './db.js';

export type EvalRunRow = {
  id: string;
  kbId: string;
  tenantId: string | null;
  status: EvalRunStatus;
  runType: string;
  retrieveMode: EvalRetrieveMode;
  signoffEligible: boolean;
  caseCount: number;
  matrix: L1MatrixDto;
  coverage: number | null;
  errorCount: number;
  ranAt: string;
  jobId: string | null;
  errorMessage: string | null;
  notes: string | null;
  passCount?: number;
  failCount?: number;
  zeroToleranceHits?: number;
  cases?: EvalRunCaseRow[];
};

export type EvalRunRepo = {
  createQueued(input: {
    tenantId: string;
    kbId: string;
    retrieveMode: EvalRetrieveMode;
    runType?: EvalRunType;
    notes?: string;
    createdBy?: string;
  }): Promise<EvalRunRow>;
  setJobId(runId: string, jobId: string | null): Promise<void>;
  getByKbAndId(kbId: string, runId: string): Promise<EvalRunRow | null>;
  listByKb(input: { kbId: string; limit: number; offset: number }): Promise<EvalRunRow[]>;
  hasQualifyingL2Archive(kbId: string): Promise<boolean>;
};

function asStatus(raw: string | null | undefined): EvalRunStatus {
  if (raw === 'queued' || raw === 'running' || raw === 'succeeded' || raw === 'failed') return raw;
  return 'succeeded';
}

function asMode(raw: string): EvalRetrieveMode {
  if (raw === 'mock' || raw === 'live' || raw === 'unknown') return raw;
  return 'unknown';
}

function l2StatsFromReport(report: unknown): {
  passCount?: number;
  failCount?: number;
  zeroToleranceHits?: number;
} {
  if (!report || typeof report !== 'object') return {};
  const row = report as Record<string, unknown>;
  const out: {
    passCount?: number;
    failCount?: number;
    zeroToleranceHits?: number;
  } = {};
  if (typeof row.passCount === 'number') out.passCount = row.passCount;
  if (typeof row.failCount === 'number') out.failCount = row.failCount;
  if (typeof row.zeroToleranceHits === 'number') out.zeroToleranceHits = row.zeroToleranceHits;
  return out;
}

function casesFromReport(report: unknown): EvalRunCaseRow[] | undefined {
  if (!report || typeof report !== 'object') return undefined;
  const cases = (report as { cases?: unknown }).cases;
  if (!Array.isArray(cases)) return undefined;
  const out: EvalRunCaseRow[] = [];
  for (const item of cases) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== 'string' || typeof row.type !== 'string') continue;
    const verdict =
      row.verdict === 'pass' || row.verdict === 'fail' || row.verdict === 'error'
        ? row.verdict
        : undefined;
    let outcome: EvalRunCaseRow['outcome'] | null = null;
    if (
      row.outcome === 'answered' ||
      row.outcome === 'abstained' ||
      row.outcome === 'error' ||
      row.outcome === 'pass' ||
      row.outcome === 'fail'
    ) {
      outcome = row.outcome;
    } else if (verdict) {
      outcome = verdict;
    }
    if (!outcome) continue;
    const cell =
      row.cell === 'A' || row.cell === 'B' || row.cell === 'C' || row.cell === 'D' ? row.cell : undefined;
    out.push({
      id: row.id,
      type: row.type,
      outcome,
      cell,
      verdict,
      reason: typeof row.reason === 'string' ? row.reason : undefined,
      errorMessage: typeof row.errorMessage === 'string' ? row.errorMessage : undefined,
    });
  }
  return out;
}

function mapRow(r: typeof evalRuns.$inferSelect, withCases: boolean): EvalRunRow {
  return {
    id: r.id,
    kbId: r.kbId,
    tenantId: r.tenantId ?? null,
    status: asStatus(r.status),
    runType: r.runType,
    retrieveMode: asMode(r.retrieveMode),
    signoffEligible: r.signoffEligible === '1' || r.signoffEligible === 'true',
    caseCount: r.caseCount,
    matrix: {
      A: r.matrixA,
      B: r.matrixB,
      C: r.matrixC,
      D: r.matrixD,
    },
    coverage: r.coverage ?? null,
    errorCount: r.errorCount,
    ranAt: r.ranAt,
    jobId: r.jobId ?? null,
    errorMessage: r.errorMessage ?? null,
    notes: r.notes ?? null,
    ...l2StatsFromReport(r.reportJson),
    cases: withCases ? casesFromReport(r.reportJson) : undefined,
  };
}

export function toEvalRunDto(row: EvalRunRow, includeCases: boolean): EvalRun {
  return {
    runId: row.id,
    kbId: row.kbId,
    status: row.status,
    runType: row.runType,
    retrieveMode: row.retrieveMode,
    signoffEligible: row.signoffEligible,
    caseCount: row.caseCount,
    matrix: row.matrix,
    coverage: row.coverage,
    errorCount: row.errorCount,
    passCount: row.passCount,
    failCount: row.failCount,
    zeroToleranceHits: row.zeroToleranceHits,
    ranAt: row.ranAt,
    jobId: row.jobId,
    errorMessage: row.errorMessage,
    notes: row.notes,
    cases: includeCases ? row.cases : undefined,
  };
}

export function resolveRetrieveMode(esMode: string | undefined): EvalRetrieveMode {
  if (esMode === 'mock') return 'mock';
  if (esMode === 'http') return 'live';
  return 'unknown';
}

export const evalRunRepo: EvalRunRepo = {
  async createQueued({ tenantId, kbId, retrieveMode, runType = 'golden_2x2', notes, createdBy }) {
    const id = uuidv7();
    const now = formatLocalDateTime();
    const [row] = await getDb()
      .insert(evalRuns)
      .values({
        id,
        tenantId,
        kbId,
        runType,
        retrieveMode,
        signoffEligible: '0',
        caseCount: 0,
        matrixA: 0,
        matrixB: 0,
        matrixC: 0,
        matrixD: 0,
        coverage: null,
        errorCount: 0,
        ranAt: now,
        status: 'queued',
        jobId: null,
        errorMessage: null,
        reportJson: null,
        notes: notes ?? null,
        createdBy: createdBy ?? null,
        updatedBy: createdBy ?? null,
      })
      .returning();
    if (!row) throw new Error('eval_runs insert returned no row');
    return mapRow(row, false);
  },

  async setJobId(runId, jobId) {
    await getDb()
      .update(evalRuns)
      .set({ jobId })
      .where(eq(evalRuns.id, runId));
  },

  async getByKbAndId(kbId, runId) {
    const [row] = await getDb()
      .select()
      .from(evalRuns)
      .where(and(eq(evalRuns.id, runId), eq(evalRuns.kbId, kbId)))
      .limit(1);
    return row ? mapRow(row, true) : null;
  },

  async listByKb({ kbId, limit, offset }) {
    const rows = await getDb()
      .select()
      .from(evalRuns)
      .where(eq(evalRuns.kbId, kbId))
      .orderBy(desc(evalRuns.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => mapRow(r, false));
  },

  async hasQualifyingL2Archive(kbId) {
    const rows = await getDb()
      .select({ id: evalRuns.id, signoffEligible: evalRuns.signoffEligible })
      .from(evalRuns)
      .where(
        and(
          eq(evalRuns.kbId, kbId),
          eq(evalRuns.runType, 'session_multiturn'),
          eq(evalRuns.status, 'succeeded'),
        ),
      )
      .limit(20);
    return rows.some((r) => r.signoffEligible === '1' || r.signoffEligible === 'true');
  },
};
