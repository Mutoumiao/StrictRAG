import { z } from 'zod';

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
  })
  .strict();

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
