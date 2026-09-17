'use client';

import type { IngestReportItem } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { listIngestReports } from './api';

export const NO_INGEST_REPORT_HINT = '暂无入库报告';

/**
 * 跨文档去重率展示口径：**未记录就不给数字**（分母为 0 的轮次、迁移前旧行）。
 * 禁止把 `null` 显示成 `0%` —— 那会把「没参与去重」说成「零重复」。
 */
export function dedupeRateLabel(rate: number | null | undefined): string {
  if (typeof rate !== 'number' || !Number.isFinite(rate)) {
    return '未记录（本轮无参与去重的切片）';
  }
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * `contextualize_l1_ok` / `contextualize_l0_fallback`（PRD 04 §5.2 报告必出）。
 * **未记录就不给数字**（迁移前旧行）；两者同批写入，任一缺失即整组未记录。
 */
export function contextualizeCountsLabel(
  l1Ok: number | null | undefined,
  l0Fallback: number | null | undefined,
): string {
  if (typeof l1Ok !== 'number' || typeof l0Fallback !== 'number') {
    return 'L1/L0 计数未记录';
  }
  return `L1 成功 ${l1Ok} · L0 回退 ${l0Fallback}`;
}

export function reportsForDoc(
  reports: readonly IngestReportItem[],
  docId: string,
): IngestReportItem[] {
  return reports.filter((r) => r.docId === docId);
}

export async function loadIngestReports(kbId: string) {
  try {
    const reports = await listIngestReports(kbId);
    return { ok: true as const, reports };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err), reports: [] as IngestReportItem[] };
  }
}
