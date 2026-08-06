'use client';

/**
 * 会话列表/详情/创建。
 * 类型来自 @strict-rag/contracts。
 */

import type {
  CreateSessionBody,
  SessionDetail,
  SessionListResponse,
  SessionSummary,
} from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function createSession(kbId: string, body: CreateSessionBody = {}) {
  return http.post<SessionSummary, CreateSessionBody>(
    `/api/v1/knowledge-bases/${kbId}/sessions`,
    body,
  );
}

export async function listSessions(kbId: string) {
  const data = await http.get<SessionListResponse>(`/api/v1/knowledge-bases/${kbId}/sessions`);
  return data.items;
}

export async function getSessionDetail(kbId: string, sessionId: string) {
  return http.get<SessionDetail>(`/api/v1/knowledge-bases/${kbId}/sessions/${sessionId}`);
}
