'use client';

/**
 * 文档列表/详情：本运营模块私有 HTTP 调用。
 * 请求/响应类型来自 @strict-rag/contracts。
 */

import type { DocumentDetail, DocumentListItem } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listDocuments(kbId: string) {
  return http.get<DocumentListItem[]>(`/api/v1/knowledge-bases/${kbId}/documents`);
}

export async function getDocument(docId: string) {
  return http.get<DocumentDetail>(`/api/v1/documents/${docId}`);
}
