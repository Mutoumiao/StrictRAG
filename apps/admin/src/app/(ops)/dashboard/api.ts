'use client';

/**
 * 数据面板：本模块私有 HTTP。
 * path 仅此处；禁止 services/UI 写 URL。
 */

import type { DashboardSummary } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function getDashboardSummary() {
  return http.get<DashboardSummary>('/api/v1/admin/dashboard/summary');
}
