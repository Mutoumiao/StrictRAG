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
