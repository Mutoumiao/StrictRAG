'use client';

/**
 * 审批中心：通过/驳回/触发扫描。
 * 列表走 documents list.services（经 approvals/services 复用），此处不复制 path。
 */

import type {
  DocumentApprovalActionResponse,
  DocumentScanEnqueueResponse,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function approveDocument(docId: string) {
  return http.post<DocumentApprovalActionResponse>(`/api/v1/documents/${docId}/approve`);
}

export async function rejectDocument(docId: string) {
  return http.post<DocumentApprovalActionResponse>(`/api/v1/documents/${docId}/reject`);
}

export async function scanDocument(docId: string) {
  return http.post<DocumentScanEnqueueResponse>(`/api/v1/documents/${docId}/scan`);
}
