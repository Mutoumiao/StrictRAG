'use client';

import type { SessionDetail, SessionSummary } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function createSession(kbId: string, title?: string) {
  return http.post<SessionSummary, { title?: string }>(
    `/api/v1/knowledge-bases/${kbId}/sessions`,
    title ? { title } : {},
  );
}

export async function listSessions(kbId: string) {
  const data = await http.get<{ items: SessionSummary[] }>(
    `/api/v1/knowledge-bases/${kbId}/sessions`,
  );
  return data.items;
}

export async function getSessionDetail(kbId: string, sessionId: string) {
  return http.get<SessionDetail>(`/api/v1/knowledge-bases/${kbId}/sessions/${sessionId}`);
}
