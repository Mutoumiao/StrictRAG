'use client';

/**
 * 文档列表/详情：本运营模块私有 HTTP 调用。
 * 请求/响应类型来自 @strict-rag/contracts。
 */

import type {
  CompleteUploadBody,
  CompleteUploadResponse,
  DocumentDetail,
  DocumentListItem,
  PatchDocumentMetaBody,
  PutObjectResponse,
  UploadUrlBody,
  UploadUrlResponse,
} from '@strict-rag/contracts';

import { readClientSession } from '@/auth/client-session';
import { getAdminClientEnv } from '@/env.client';
import { ApiHttpError, http } from '@/lib/http';

export async function listDocuments(kbId: string) {
  return http.get<DocumentListItem[]>(`/api/v1/knowledge-bases/${kbId}/documents`);
}

export async function getDocument(docId: string) {
  return http.get<DocumentDetail>(`/api/v1/documents/${docId}`);
}

export async function patchDocumentMeta(docId: string, body: PatchDocumentMetaBody) {
  return http.patch<DocumentDetail, PatchDocumentMetaBody>(`/api/v1/documents/${docId}`, body);
}

export async function requestUploadUrl(kbId: string, body: UploadUrlBody) {
  return http.post<UploadUrlResponse, UploadUrlBody>(
    `/api/v1/knowledge-bases/${kbId}/documents/upload-url`,
    body,
  );
}

export async function putUploadedObject(uploadUrl: string, blob: Blob, contentType: string) {
  const headers = new Headers();
  headers.set('content-type', contentType);
  const session = readClientSession();
  if (session) headers.set('authorization', `Bearer ${session.accessToken}`);
  const abs = uploadUrl.startsWith('http')
    ? uploadUrl
    : `${getAdminClientEnv().NEXT_PUBLIC_API_BASE_URL.replace(/\/$/, '')}${uploadUrl}`;
  const res = await fetch(abs, { method: 'PUT', headers, body: blob });
  const payload = (await res.json()) as { ok: boolean; data?: PutObjectResponse; error?: { code: string; message: string } };
  if (!payload.ok || !payload.data) {
    throw new ApiHttpError(payload.error?.code ?? 'INTERNAL', payload.error?.message ?? 'put failed', false);
  }
  return payload.data;
}

export async function completeUpload(kbId: string, docId: string, body: CompleteUploadBody) {
  return http.post<CompleteUploadResponse, CompleteUploadBody>(
    `/api/v1/knowledge-bases/${kbId}/documents/${docId}/complete`,
    body,
  );
}
