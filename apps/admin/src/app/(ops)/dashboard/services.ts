'use client';

/**
 * 数据面板用例：调 api、错误映射。无 path；不做权限决策。
 */

import type { DashboardSummary } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { getDashboardSummary } from './api';

export type LoadSummaryResult =
  | { ok: true; summary: DashboardSummary }
  | { ok: false; message: string };

export async function loadDashboardSummary(): Promise<LoadSummaryResult> {
  try {
    const summary = await getDashboardSummary();
    return { ok: true, summary };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
