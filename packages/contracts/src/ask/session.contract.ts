import { z } from 'zod';

export const CreateSessionBodySchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
  })
  .strict();

export type CreateSessionBody = z.infer<typeof CreateSessionBodySchema>;

export const SessionSummarySchema = z.object({
  sessionId: z.string().uuid(),
  title: z.string().nullable().optional(),
  status: z.enum(['open', 'closed']),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  requestId: z.string().optional(),
  status: z.enum(['answered', 'abstained']).optional(),
  reason: z.string().optional(),
  createdAt: z.string().optional(),
});

export type SessionMessage = z.infer<typeof SessionMessageSchema>;

export const SessionDetailSchema = SessionSummarySchema.extend({
  messages: z.array(SessionMessageSchema).default([]),
});

export type SessionDetail = z.infer<typeof SessionDetailSchema>;

/** GET …/sessions 列表 data */
export const SessionListResponseSchema = z.object({
  items: z.array(SessionSummarySchema),
});
export type SessionListResponse = z.infer<typeof SessionListResponseSchema>;

/** GET …/sessions 查询参数 */
export const SessionListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type SessionListQuery = z.infer<typeof SessionListQuerySchema>;
