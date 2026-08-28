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

/** 同步 ask 响应 / 流式 data-ask-final 同源 */
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

/**
 * AI SDK UI Message Stream · data-status（transient）。
 * phase 表示图进度；错误时附 code/message。
 */
export const AskSseStatusSchema = z.object({
  phase: z.string().min(1),
  status: z.string().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});
export type AskSseStatus = z.infer<typeof AskSseStatusSchema>;

/**
 * @deprecated 流协议已改为 AI SDK data-status / data-ask-final；保留类型兼容旧引用。
 */
export const AskSseErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  reason: AskReasonSchema.optional(),
});
export type AskSseError = z.infer<typeof AskSseErrorSchema>;

/**
 * GET /ask/:requestId 审计回溯。
 * 当时 evidence 快照（preview 截断）+ graph_trace；**不是**断线重拉 AskResponse。
 * 禁止夹带正文 text/body。
 */
export const EVIDENCE_SNAPSHOT_PREVIEW_MAX = 200;

export const EvidenceSnapshotItemSchema = z
  .object({
    chunkId: z.string().uuid(),
    docId: z.string().uuid(),
    lifecycle: z.string().optional(),
    preview: z.string().max(EVIDENCE_SNAPSHOT_PREVIEW_MAX).optional(),
    title: z.string().optional(),
  })
  .strict();

export type EvidenceSnapshotItem = z.infer<typeof EvidenceSnapshotItemSchema>;

/** 审计口只放图计数/路由标签，禁止任意 JSON 夹带正文 */
export const AskGraphTraceSchema = z
  .object({
    llmCalls: z.number().optional(),
    retrieveCalls: z.number().optional(),
    route_source: z.string().optional(),
    routeLabel: z.string().optional(),
  })
  .strict();

export type AskGraphTrace = z.infer<typeof AskGraphTraceSchema>;

export const AskAuditResponseSchema = z
  .object({
    requestId: z.string().min(1),
    kbId: z.string().uuid(),
    status: AskStatusSchema,
    reason: AskReasonSchema,
    mode: z.enum(['fast', 'balanced', 'strict']).optional(),
    latencyMs: z.number().int().nonnegative().optional(),
    sessionId: z.string().uuid().nullable().optional(),
    evidenceSnapshot: z.array(EvidenceSnapshotItemSchema),
    graphTrace: AskGraphTraceSchema.nullable(),
  })
  .strict();

export type AskAuditResponse = z.infer<typeof AskAuditResponseSchema>;
