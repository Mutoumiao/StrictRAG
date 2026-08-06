'use client';

/**
 * 审批中心：通过/驳回/触发扫描。
 * 列表复用文档模块 listDocuments（跨模块只依赖对方公开函数，不复制路径）。
 */

import type {
  DocumentApprovalActionResponse,
  DocumentScanEnqueueResponse,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export { listDocuments } from '../documents/api';

export async function approveDocument(docId: string) {
  return http.post<DocumentApprovalActionResponse>(`/api/v1/documents/${docId}/approve`);
}

export async function rejectDocument(docId: string) {
  return http.post<DocumentApprovalActionResponse>(`/api/v1/documents/${docId}/reject`);
}

export async function scanDocument(docId: string) {
  return http.post<DocumentScanEnqueueResponse>(`/api/v1/documents/${docId}/scan`);
}
