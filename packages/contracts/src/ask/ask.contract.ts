import { z } from 'zod';

import { AskReasonSchema } from './reason.js';

/** options 仅四字段；strict 拒绝 tauClaim / retrieveK / scope 等（ADR-050） */
export const AskOptionsSchema = z
  .object({
    stream: z.boolean().optional(),
    debug: z.boolean().optional(),
    mode: z.enum(['fast', 'balanced', 'strict']).optional(),
    locale: z.string().min(1).max(32).optional(),
  })
  .strict();

export type AskOptions = z.infer<typeof AskOptionsSchema>;

/** scope 顶层；禁止塞进 options */
export const AskScopeSchema = z
  .object({
    docTypes: z.array(z.string().min(1).max(64)).max(32).optional(),
  })
  .strict();

export type AskScope = z.infer<typeof AskScopeSchema>;

export const AskRequestSchema = z
  .object({
    question: z.string().min(1).max(8000),
    sessionId: z.string().uuid().nullable().optional(),
    scope: AskScopeSchema.optional(),
    options: AskOptionsSchema.optional(),
  })
  .strict();

export type AskRequest = z.infer<typeof AskRequestSchema>;

export const AskCitationSchema = z.object({
  chunkId: z.string().uuid(),
  docId: z.string().uuid(),
  title: z.string().optional(),
  preview: z.string().optional(),
  sectionPath: z.string().optional(),
  lifecycle: z.string().optional(),
});

export type AskCitation = z.infer<typeof AskCitationSchema>;

export const SuggestedActionSchema = z.object({
  type: z.string().min(1),
  label: z.string().min(1),
});

export type SuggestedAction = z.infer<typeof SuggestedActionSchema>;

export const AskStatusSchema = z.enum(['answered', 'abstained']);
export type AskStatus = z.infer<typeof AskStatusSchema>;

export const AskAnswerKindSchema = z.enum(['knowledge', 'chitchat']);
export type AskAnswerKind = z.infer<typeof AskAnswerKindSchema>;

/** 同步 ask 响应 / SSE final 同源 */
export const AskResponseSchema = z.object({
  requestId: z.string().min(1),
  status: AskStatusSchema,
  answer: z.string(),
  answerKind: AskAnswerKindSchema.optional(),
  citations: z.array(AskCitationSchema).default([]),
  minSupport: z.number().min(0).max(1).optional(),
  reason: AskReasonSchema,
  userMessage: z.string().optional(),
  suggestedActions: z.array(SuggestedActionSchema).default([]),
  latencyMs: z.number().int().nonnegative().optional(),
  mode: z.enum(['fast', 'balanced', 'strict']).optional(),
  sessionId: z.string().uuid().nullable().optional(),
  /** debug=true 时可含；默认不强制 */
  debug: z.record(z.string(), z.unknown()).optional(),
});

export type AskResponse = z.infer<typeof AskResponseSchema>;
