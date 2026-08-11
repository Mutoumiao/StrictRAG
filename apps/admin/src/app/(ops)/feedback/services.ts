'use client';

import type { FeedbackItem } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { listFeedbackQueue, patchFeedbackStatus } from './api';

export type LoadQueueResult =
  | { ok: true; items: FeedbackItem[] }
  | { ok: false; message: string };

export async function loadFeedbackQueue(kbId: string): Promise<LoadQueueResult> {
  try {
    const data = await listFeedbackQueue(kbId);
    return { ok: true, items: data.items ?? [] };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function resolveFeedback(
  feedbackId: string,
  status: FeedbackItem['status'],
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await patchFeedbackStatus(feedbackId, status);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
