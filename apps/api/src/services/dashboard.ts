import type {
  DashboardQualityTrack,
  DashboardSummary,
  DashboardTracks,
  EvalRetrieveMode,
} from '@strict-rag/contracts';
import {
  askTraces,
  documents,
  evalRuns,
  formatLocalDateTime,
  knowledgeBases,
} from '@strict-rag/db';
import { and, count, desc, eq, gte } from 'drizzle-orm';

import { runReadyChecks } from '../ready/checks.js';
import { extraStatsFromReport } from './eval-runs.js';
import { getDb } from './db.js';

export const EMPTY_QUALITY_TRACK: DashboardQualityTrack = {
  evalRunId: null,
  retrieveMode: null,
  matrix: null,
  coverage: null,
  hitAtK: null,
  tauStar: null,
  judgeAuroc: null,
};

/** 可注入计数 / 就绪 / 双轨，便于单测不碰真 DB。 */
export type DashboardRepo = {
  countKbs(): Promise<number>;
  countDocuments(): Promise<number>;
  countPendingApproval(): Promise<number>;
  countAsksSince(sinceLocal: string): Promise<number>;
  processReady(): Promise<boolean>;
  latestL1Quality(): Promise<DashboardQualityTrack>;
  latencySince(sinceLocal: string): Promise<{
    askCount: number;
    scoredCount: number;
    avgMs: number | null;
    p95Ms: number | null;
  }>;
};

export const dashboardRepo: DashboardRepo = {
  async countKbs() {
    const db = getDb();
    const [row] = await db.select({ n: count() }).from(knowledgeBases);
    return Number(row?.n ?? 0);
  },
  async countDocuments() {
    const db = getDb();
    const [row] = await db.select({ n: count() }).from(documents);
    return Number(row?.n ?? 0);
  },
  async countPendingApproval() {
    const db = getDb();
    const [row] = await db
      .select({ n: count() })
      .from(documents)
      .where(eq(documents.approvalStatus, 'pending'));
    return Number(row?.n ?? 0);
  },
  async countAsksSince(sinceLocal) {
    const db = getDb();
    // createdAt 为本地格式串；字符串比较在 yyyy-MM-dd HH:mm:ss 下可用
    const [row] = await db
      .select({ n: count() })
      .from(askTraces)
      .where(gte(askTraces.createdAt, sinceLocal));
    return Number(row?.n ?? 0);
  },
  async processReady() {
    const { ready } = await runReadyChecks();
    return ready;
  },
  async latestL1Quality() {
    const db = getDb();
    const [row] = await db
      .select()
      .from(evalRuns)
      .where(and(eq(evalRuns.status, 'succeeded'), eq(evalRuns.runType, 'golden_2x2')))
      .orderBy(desc(evalRuns.ranAt))
      .limit(1);
    if (!row) return { ...EMPTY_QUALITY_TRACK };
    return qualityFromEvalRow(row);
  },
  async latencySince(sinceLocal) {
    const db = getDb();
    const rows = await db
      .select({ latencyMs: askTraces.latencyMs })
      .from(askTraces)
      .where(gte(askTraces.createdAt, sinceLocal));
    const samples = rows
      .map((r) => r.latencyMs)
      .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
    const stats = summarizeLatencies(samples);
    return { askCount: rows.length, ...stats };
  },
};

export type MemoryDashboardSeed = Partial<DashboardSummary> & {
  quality?: DashboardQualityTrack;
  latency?: {
    askCount?: number;
    scoredCount?: number;
    avgMs?: number | null;
    p95Ms?: number | null;
  };
};

export function createMemoryDashboardRepo(seed: MemoryDashboardSeed = {}): DashboardRepo {
  const state = {
    kbCount: seed.kbCount ?? 0,
    documentCount: seed.documentCount ?? 0,
    pendingApprovalCount: seed.pendingApprovalCount ?? 0,
    processReady: seed.processReady ?? true,
    askCount24h: seed.askCount24h ?? 0,
    quality: seed.quality ?? { ...EMPTY_QUALITY_TRACK },
    latency: {
      askCount: seed.latency?.askCount ?? seed.askCount24h ?? 0,
      scoredCount: seed.latency?.scoredCount ?? 0,
      avgMs: seed.latency?.avgMs ?? null,
      p95Ms: seed.latency?.p95Ms ?? null,
    },
  };
  return {
    countKbs: async () => state.kbCount,
    countDocuments: async () => state.documentCount,
    countPendingApproval: async () => state.pendingApprovalCount,
    countAsksSince: async () => state.askCount24h,
    processReady: async () => state.processReady,
    latestL1Quality: async () => ({ ...state.quality }),
    latencySince: async () => ({ ...state.latency }),
  };
}

/** 24h 窗口起点（本地格式串，对齐写库时间）。 */
export function since24hLocal(now = new Date()): string {
  return formatLocalDateTime(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

export async function getDashboardSummary(
  repo: DashboardRepo = dashboardRepo,
): Promise<DashboardSummary> {
  const since = since24hLocal();
  const [kbCount, documentCount, pendingApprovalCount, processReady, askCount24h] =
    await Promise.all([
      repo.countKbs(),
      repo.countDocuments(),
      repo.countPendingApproval(),
      repo.processReady(),
      repo.countAsksSince(since),
    ]);

  return {
    kbCount,
    documentCount,
    pendingApprovalCount,
    processReady,
    askCount24h,
  };
}

/** 连续百分位（与 PG percentile_cont 同口径）；空样本 → null。 */
export function percentileCont(sortedAsc: number[], p: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (p <= 0) return sortedAsc[0] ?? null;
  if (p >= 1) return sortedAsc[sortedAsc.length - 1] ?? null;
  const h = (sortedAsc.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  const a = sortedAsc[lo];
  const b = sortedAsc[hi];
  if (a === undefined || b === undefined) return null;
  if (lo === hi) return a;
  return a + (b - a) * (h - lo);
}

export function summarizeLatencies(samples: number[]): {
  scoredCount: number;
  avgMs: number | null;
  p95Ms: number | null;
} {
  const scored = samples.filter((n) => Number.isFinite(n));
  if (scored.length === 0) {
    return { scoredCount: 0, avgMs: null, p95Ms: null };
  }
  const sum = scored.reduce((s, n) => s + n, 0);
  const sorted = [...scored].sort((a, b) => a - b);
  const p95 = percentileCont(sorted, 0.95);
  return {
    scoredCount: scored.length,
    avgMs: Math.round(sum / scored.length),
    p95Ms: p95 === null ? null : Math.round(p95),
  };
}

function asRetrieveMode(raw: string | null | undefined): EvalRetrieveMode {
  if (raw === 'mock' || raw === 'live' || raw === 'unknown') return raw;
  return 'unknown';
}

function qualityFromEvalRow(row: {
  id: string;
  retrieveMode: string;
  coverage: number | null;
  matrixA: number;
  matrixB: number;
  matrixC: number;
  matrixD: number;
  reportJson: unknown;
}): DashboardQualityTrack {
  const extra = extraStatsFromReport(row.reportJson);
  return {
    evalRunId: row.id,
    retrieveMode: asRetrieveMode(row.retrieveMode),
    matrix: { A: row.matrixA, B: row.matrixB, C: row.matrixC, D: row.matrixD },
    coverage: typeof row.coverage === 'number' && Number.isFinite(row.coverage) ? row.coverage : null,
    hitAtK: typeof extra.hitAtK === 'number' && Number.isFinite(extra.hitAtK) ? extra.hitAtK : null,
    tauStar: extra.tauStar ?? null,
    judgeAuroc: extra.judgeAuroc ?? null,
  };
}

export async function getDashboardTracks(
  repo: DashboardRepo = dashboardRepo,
): Promise<DashboardTracks> {
  const since = since24hLocal();
  const [quality, latency] = await Promise.all([
    repo.latestL1Quality(),
    repo.latencySince(since),
  ]);
  return {
    quality,
    latency: {
      windowHours: 24,
      askCount: latency.askCount,
      scoredCount: latency.scoredCount,
      avgMs: latency.avgMs,
      p95Ms: latency.p95Ms,
    },
  };
}
