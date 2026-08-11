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
export type CreateKbBody = z.infer<typeof CreateKbBodySchema>;

/** POST /knowledge-bases */
export const CreateKbResponseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
});
export type CreateKbResponse = z.infer<typeof CreateKbResponseSchema>;

export const UploadUrlBodySchema = z.object({
  title: z.string().min(1).max(500),
  contentType: z.string().min(1).max(200),
  /** 客户端预估大小；权威闸在 complete Head */
  declaredByteSize: z.number().int().nonnegative().optional(),
});
export type UploadUrlBody = z.infer<typeof UploadUrlBodySchema>;

/** POST …/documents/upload-url */
export const UploadUrlResponseSchema = z.object({
  docId: z.string().uuid(),
  uploadUrl: z.string().min(1),
  method: z.string().min(1),
  objectKey: z.string().min(1),
  maxBytes: z.number().int().positive(),
});
export type UploadUrlResponse = z.infer<typeof UploadUrlResponseSchema>;

export const CompleteUploadBodySchema = z.object({
  /** 可选：客户端声称的 size；服务端以对象实际大小为准 */
  declaredByteSize: z.number().int().nonnegative().optional(),
  /**
   * B12：分片策略码（须已注册）；省略时服务端用默认 structure_paragraph。
   * 多策略并存时客户端应显式传。
   */
  chunkStrategy: z.string().min(1).max(64).optional(),
});
export type CompleteUploadBody = z.infer<typeof CompleteUploadBodySchema>;

/** POST …/documents/:docId/complete */
export const CompleteUploadResponseSchema = z.object({
  docId: z.string().uuid(),
  byteSize: z.number().int().nonnegative(),
  approvalStatus: ApprovalStatusSchema,
  status: DocumentStatusSchema,
});
export type CompleteUploadResponse = z.infer<typeof CompleteUploadResponseSchema>;

export const PatchLifecycleBodySchema = z.object({
  lifecycle: LifecycleSchema,
});
export type PatchLifecycleBody = z.infer<typeof PatchLifecycleBodySchema>;

/** PATCH …/documents/:docId/lifecycle */
export const PatchLifecycleResponseSchema = z.object({
  docId: z.string().uuid(),
  lifecycle: LifecycleSchema,
  status: z.string(),
});
export type PatchLifecycleResponse = z.infer<typeof PatchLifecycleResponseSchema>;

/** PUT /internal/objects（本地 storage 上传） */
export const PutObjectResponseSchema = z.object({
  key: z.string().min(1),
  byteSize: z.number().int().nonnegative(),
  checksumSha256: z.string().min(1),
});
export type PutObjectResponse = z.infer<typeof PutObjectResponseSchema>;

export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;
export type Lifecycle = z.infer<typeof LifecycleSchema>;

/** GET …/knowledge-bases/:kbId/documents 列表项 */
export const DocumentListItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: DocumentStatusSchema,
  approvalStatus: ApprovalStatusSchema,
  lifecycle: LifecycleSchema,
  byteSize: z.number().int().nonnegative().nullable(),
  indexVersion: z.number().int(),
  errorCode: z.string().nullable(),
  embedReady: z.boolean(),
  esReady: z.boolean(),
});
export type DocumentListItem = z.infer<typeof DocumentListItemSchema>;

/**
 * GET /documents/:docId 公开详情（非 DB 行直出）。
 * 不含 parsedText / 对象内部密钥类字段。
 */
export const DocumentDetailSchema = DocumentListItemSchema.extend({
  tenantId: z.string().uuid(),
  kbId: z.string().uuid(),
  sourceType: z.string().optional(),
  contentType: z.string().nullable().optional(),
  errorMessage: z.string().nullable().optional(),
  docType: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type DocumentDetail = z.infer<typeof DocumentDetailSchema>;

/** POST …/documents/:docId/approve | reject */
export const DocumentApprovalActionResponseSchema = z.object({
  docId: z.string().uuid(),
  approvalStatus: ApprovalStatusSchema,
});
export type DocumentApprovalActionResponse = z.infer<
  typeof DocumentApprovalActionResponseSchema
>;

/** POST …/documents/:docId/scan */
export const DocumentScanEnqueueResponseSchema = z.object({
  docId: z.string().uuid(),
  enqueued: z.boolean(),
  jobId: z.string().optional(),
  stage: z.string(),
});
export type DocumentScanEnqueueResponse = z.infer<typeof DocumentScanEnqueueResponseSchema>;
