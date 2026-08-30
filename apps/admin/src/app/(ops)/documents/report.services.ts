'use client';

import type { IngestReportItem } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { listIngestReports } from './api';

export const NO_INGEST_REPORT_HINT = '暂无入库报告';

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
