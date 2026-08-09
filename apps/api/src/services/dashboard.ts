import type { DashboardSummary } from '@strict-rag/contracts';
import {
  askTraces,
  documents,
  formatLocalDateTime,
  knowledgeBases,
} from '@strict-rag/db';
import { count, eq, gte } from 'drizzle-orm';

import { runReadyChecks } from '../ready/checks.js';
import { getDb } from './db.js';

/** 可注入计数 / 就绪，便于单测不碰真 DB。 */
export type DashboardRepo = {
  countKbs(): Promise<number>;
  countDocuments(): Promise<number>;
  countPendingApproval(): Promise<number>;
  countAsksSince(sinceLocal: string): Promise<number>;
  processReady(): Promise<boolean>;
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
};

export function createMemoryDashboardRepo(seed: Partial<DashboardSummary> = {}): DashboardRepo {
  const state = {
    kbCount: seed.kbCount ?? 0,
    documentCount: seed.documentCount ?? 0,
    pendingApprovalCount: seed.pendingApprovalCount ?? 0,
    processReady: seed.processReady ?? true,
    askCount24h: seed.askCount24h ?? 0,
  };
  return {
    countKbs: async () => state.kbCount,
    countDocuments: async () => state.documentCount,
    countPendingApproval: async () => state.pendingApprovalCount,
    countAsksSince: async () => state.askCount24h,
    processReady: async () => state.processReady,
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
