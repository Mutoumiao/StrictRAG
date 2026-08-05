'use client';

/**
 * 管理端对 API 的薄封装。无业务状态机；权限仍以服务端为准。
 */

import type { InviteMemberBody, KbMember } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export type DocRow = {
  id: string;
  title: string;
  status: string;
  approvalStatus: string;
  lifecycle: string;
  byteSize: number | null;
  indexVersion: number;
  errorCode: string | null;
  embedReady: boolean | number;
  esReady: boolean | number;
};

const KB_STORAGE = 'strict-rag:admin:last-kb-id';

export function readStoredKbId(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(KB_STORAGE) ?? '';
}

export function writeStoredKbId(kbId: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KB_STORAGE, kbId);
}

export async function listDocuments(kbId: string) {
  return http.get<DocRow[]>(`/api/v1/knowledge-bases/${kbId}/documents`);
}

export async function approveDocument(docId: string) {
  return http.post<{ docId: string; approvalStatus: string }>(
    `/api/v1/documents/${docId}/approve`,
  );
}

export async function rejectDocument(docId: string) {
  return http.post<{ docId: string; approvalStatus: string }>(
    `/api/v1/documents/${docId}/reject`,
  );
}

export async function scanDocument(docId: string) {
  return http.post<{ docId: string; enqueued: boolean; jobId?: string; stage: string }>(
    `/api/v1/documents/${docId}/scan`,
  );
}

export async function listMembers(kbId: string) {
  return http.get<KbMember[]>(`/api/v1/knowledge-bases/${kbId}/members`);
}

export async function inviteMember(kbId: string, body: InviteMemberBody) {
  return http.post<{ kbId: string; userId: string; role: string }, InviteMemberBody>(
    `/api/v1/knowledge-bases/${kbId}/members`,
    body,
  );
}

export async function removeMember(kbId: string, userId: string) {
  return http.delete<{ kbId: string; userId: string; removed: boolean }>(
    `/api/v1/knowledge-bases/${kbId}/members/${userId}`,
  );
}
