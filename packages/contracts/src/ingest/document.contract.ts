import { z } from 'zod';

export const DocumentStatusSchema = z.enum([
  'uploaded',
  'scanning',
  'parsing',
  'chunking',
  'embedding',
  'indexing_es',
  'ready',
  'failed',
  'needs_ocr',
  'needs_review',
]);

export const ApprovalStatusSchema = z.enum(['none', 'pending', 'approved', 'rejected']);
export const LifecycleSchema = z.enum(['draft', 'active', 'superseded', 'archived']);

export const CreateKbBodySchema = z.object({
  tenantId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const UploadUrlBodySchema = z.object({
  title: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  /** 客户端预估大小；权威闸在 complete Head */
  declaredByteSize: z.number().int().nonnegative().optional(),
});

export const CompleteUploadBodySchema = z.object({
  /** 可选：客户端声称的 size；服务端以对象实际大小为准 */
  declaredByteSize: z.number().int().nonnegative().optional(),
});

export const PatchLifecycleBodySchema = z.object({
  lifecycle: z.enum(['draft', 'active', 'superseded', 'archived']),
});

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type Lifecycle = z.infer<typeof LifecycleSchema>;
