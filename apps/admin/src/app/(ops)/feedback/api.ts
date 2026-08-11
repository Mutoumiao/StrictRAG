'use client';

import type { FeedbackItem, FeedbackListResponse } from '@strict-rag/contracts';

import { http } from '@/lib/http';

export async function listFeedbackQueue(kbId: string, status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  return http.get<FeedbackListResponse>(
    `/api/v1/knowledge-bases/${kbId}/feedback-queue${q}`,
  );
}

export async function patchFeedbackStatus(feedbackId: string, status: FeedbackItem['status']) {
  return http.patch<FeedbackItem>(`/api/v1/feedback/${feedbackId}`, { status });
}
