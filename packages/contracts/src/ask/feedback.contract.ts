import { z } from 'zod';

import { GOLD_TYPES } from '../eval/l1-matrix.js';

export const CreateFeedbackBodySchema = z
  .object({
    requestId: z.string().min(1),
    rating: z.enum(['up', 'down']).optional(),
    category: z.string().min(1).max(64).optional(),
    comment: z.string().max(4000).optional(),
  })
  .strict()
  .refine((v) => v.rating !== undefined || v.category !== undefined || v.comment !== undefined, {
    message: '至少提供 rating / category / comment 之一',
  });

export type CreateFeedbackBody = z.infer<typeof CreateFeedbackBodySchema>;

export const FeedbackStatusSchema = z.enum([
  'open',
  'dismissed',
  'linked_doc',
  'queued_reindex',
  'promoted_to_gold',
]);

export type FeedbackStatus = z.infer<typeof FeedbackStatusSchema>;

/** 管理员处理反馈（不得改回无 handler 的 open 以外的随意态；允许 open→* 与状态迁移） */
export const PatchFeedbackBodySchema = z
  .object({
    status: FeedbackStatusSchema,
    /** 仅 status=promoted_to_gold 必填；其它状态可省略 */
    goldType: z.enum(GOLD_TYPES).optional(),
  })
  .strict()
  .refine((v) => v.status !== 'promoted_to_gold' || v.goldType !== undefined, {
    message: 'promoted_to_gold requires goldType',
  });

export type PatchFeedbackBody = z.infer<typeof PatchFeedbackBodySchema>;

export const FeedbackItemSchema = z.object({
  feedbackId: z.string().uuid(),
  requestId: z.string().min(1),
  kbId: z.string().uuid(),
  userId: z.string().uuid(),
  rating: z.enum(['up', 'down']).nullable().optional(),
  category: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
  status: FeedbackStatusSchema,
  handlerId: z.string().uuid().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});

export type FeedbackItem = z.infer<typeof FeedbackItemSchema>;

/** GET …/feedback-queue data */
export const FeedbackListResponseSchema = z.object({
  items: z.array(FeedbackItemSchema),
});
export type FeedbackListResponse = z.infer<typeof FeedbackListResponseSchema>;

/** GET …/feedback-queue 查询参数 */
export const FeedbackQueueQuerySchema = z.object({
  status: FeedbackStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type FeedbackQueueQuery = z.infer<typeof FeedbackQueueQuerySchema>;

/** 运营黄金集题号：每条反馈至多一题，不与手建 caseKey 碰撞 */
export const FEEDBACK_GOLD_CASE_KEY_PREFIX = 'fb-';

export function goldCaseKeyFromFeedbackId(feedbackId: string): string {
  return `${FEEDBACK_GOLD_CASE_KEY_PREFIX}${feedbackId}`;
}

/** 题面只来自当时 ask；comment 不得冒充问句 */
export function deriveGoldQuestionText(input: {
  standaloneQuestion?: string | null;
  rawQuestion?: string | null;
}): string | null {
  const standalone = input.standaloneQuestion?.trim() ?? '';
  if (standalone.length > 0) return standalone.slice(0, 8000);
  const raw = input.rawQuestion?.trim() ?? '';
  if (raw.length > 0) return raw.slice(0, 8000);
  return null;
}

export function goldRubricFromFeedbackComment(comment?: string | null): string | null {
  const text = comment?.trim() ?? '';
  if (text.length === 0) return null;
  return text.slice(0, 4000);
}
