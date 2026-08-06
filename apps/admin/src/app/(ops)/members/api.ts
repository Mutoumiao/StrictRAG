'use client';

/**
 * 成员管理模块私有 HTTP 调用。
 * 请求/响应类型来自 @strict-rag/contracts。
 */

import type {
  InviteMemberBody,
  InviteMemberResponse,
  KbMember,
  RemoveMemberResponse,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listMembers(kbId: string) {
  return http.get<KbMember[]>(`/api/v1/knowledge-bases/${kbId}/members`);
}

export async function inviteMember(kbId: string, body: InviteMemberBody) {
  return http.post<InviteMemberResponse, InviteMemberBody>(
    `/api/v1/knowledge-bases/${kbId}/members`,
    body,
  );
}

export async function removeMember(kbId: string, userId: string) {
  return http.delete<RemoveMemberResponse>(
    `/api/v1/knowledge-bases/${kbId}/members/${userId}`,
  );
}
