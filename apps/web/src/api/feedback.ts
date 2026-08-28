'use client';

/**
 * 用户对单次 ask 的反馈提交。
 * 类型来自 @strict-rag/contracts。
 */

import type { CreateFeedbackBody, FeedbackItem } from '@strict-rag/contracts';

import { http } from '@/lib/http';

/** 与 api 测例字符串对齐：报错 / 缺文档 */
export const FEEDBACK_CATEGORY = {
  wrongAnswer: 'wrong_answer',
  missingDoc: 'missing_doc',
} as const;

export async function createAskFeedback(
  requestId: string,
  body: Omit<CreateFeedbackBody, 'requestId'>,
) {
  return http.post<FeedbackItem, CreateFeedbackBody>(`/api/v1/ask/${requestId}/feedback`, {
    ...body,
    requestId,
  });
}
