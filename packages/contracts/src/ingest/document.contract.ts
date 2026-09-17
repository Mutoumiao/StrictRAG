import { z } from 'zod';

import { LocalDateTimeStringSchema } from '../common/local-datetime.js';
import { SHA256_HEX_RE } from './upload-media.js';

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

/** POST /knowledge-bases。tenantId 以令牌为准，body 即使带上也会被丢掉。 */
export const CreateKbBodySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  initialAdminUserId: z.string().uuid(),
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

/** GET /knowledge-bases 列表项（身份可见库） */
export const KnowledgeBaseListItemSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
});
export type KnowledgeBaseListItem = z.infer<typeof KnowledgeBaseListItemSchema>;

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

/** 文档可见级：10/20/30/40（P3b-META；检索强制默认关） */
export const VisibilityLevelSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(30),
  z.literal(40),
]);
export type VisibilityLevel = z.infer<typeof VisibilityLevelSchema>;

export const CompleteUploadBodySchema = z.object({
  /** 可选：客户端声称的 size；服务端以对象实际大小为准 */
  declaredByteSize: z.number().int().nonnegative().optional(),
  /**
   * 分片策略码（须已实现且在 for-upload available）。
   * 该 MIME 族仅 1 个可用时可省略（服务端自动）；≥2 未传 → 400。
   */
  chunkStrategy: z.string().min(1).max(64).optional(),
  ownerDeptId: z.string().uuid().nullable().optional(),
  visibilityLevel: VisibilityLevelSchema.optional(),
  /** omit 不改；null 清回未设；[] 显式空 */
  aclPrincipals: z.array(z.string().uuid()).max(256).nullable().optional(),
  /** 可选：客户端声称的 sha256；权威以对象字节为准 */
  checksumSha256: z.string().regex(SHA256_HEX_RE).optional(),
});
export type CompleteUploadBody = z.infer<typeof CompleteUploadBodySchema>;

/** POST …/documents/:docId/complete */
export const CompleteUploadResponseSchema = z.object({
  docId: z.string().uuid(),
  byteSize: z.number().int().nonnegative(),
  approvalStatus: ApprovalStatusSchema,
  status: DocumentStatusSchema,
  /** B12：落库策略码 */
  chunkStrategy: z.string().min(1).optional(),
});
export type CompleteUploadResponse = z.infer<typeof CompleteUploadResponseSchema>;

/** POST …/documents/write · 在线编写（Markdown，进审批，不入队 scan） */
export const WriteDocumentBodySchema = z.object({
  title: z.string().trim().min(1).max(500),
  markdown: z.string().trim().min(1).max(1_048_576),
  chunkStrategy: z.string().min(1).max(64).optional(),
  ownerDeptId: z.string().uuid().nullable().optional(),
  visibilityLevel: VisibilityLevelSchema.optional(),
  aclPrincipals: z.array(z.string().uuid()).max(256).nullable().optional(),
});
export type WriteDocumentBody = z.infer<typeof WriteDocumentBodySchema>;

export const WriteDocumentResponseSchema = CompleteUploadResponseSchema.extend({
  sourceType: z.literal('write'),
});
export type WriteDocumentResponse = z.infer<typeof WriteDocumentResponseSchema>;

/** POST …/documents/:docId/reindex · B12 多策略时 body 必带 chunkStrategy */
export const ReindexDocumentBodySchema = z.object({
  chunkStrategy: z.string().min(1).max(64).optional(),
});
export type ReindexDocumentBody = z.infer<typeof ReindexDocumentBodySchema>;

export const ReindexDocumentResponseSchema = z.object({
  docId: z.string().uuid(),
  enqueued: z.literal(true),
  jobId: z.string().min(1),
  /** ready 等走 chunk；卡在 OCR 闸的扫描件走 ocr */
  stage: z.enum(['chunk', 'ocr']),
  chunkStrategy: z.string().min(1),
  strategyChanged: z.boolean(),
});
export type ReindexDocumentResponse = z.infer<typeof ReindexDocumentResponseSchema>;

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

/** POST …/documents/:docId/supersede · :docId 为被替代旧文 */
export const SupersedeDocumentBodySchema = z.object({
  successorDocId: z.string().uuid(),
});
export type SupersedeDocumentBody = z.infer<typeof SupersedeDocumentBodySchema>;

export const SupersedeDocumentResponseSchema = z.object({
  oldDocId: z.string().uuid(),
  successorDocId: z.string().uuid(),
  oldLifecycle: z.literal('superseded'),
  successorLifecycle: z.literal('active'),
});
export type SupersedeDocumentResponse = z.infer<typeof SupersedeDocumentResponseSchema>;

/** DELETE …/documents/:docId · 先 archived 再入队 purge */
export const DeleteDocumentResponseSchema = z.object({
  docId: z.string().uuid(),
  lifecycle: z.literal('archived'),
  purgeEnqueued: z.literal(true),
});
export type DeleteDocumentResponse = z.infer<typeof DeleteDocumentResponseSchema>;

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
  /**
   * 提交人 userId（落 `documents.uploaded_by`）。
   * null = 认不出提交人（历史文 / `AUTH_ENFORCE` 关时无 actor）；此时四眼闸不生效。
   */
  submittedBy: z.string().uuid().nullable().default(null),
  lifecycle: LifecycleSchema,
  byteSize: z.number().int().nonnegative().nullable(),
  indexVersion: z.number().int(),
  errorCode: z.string().nullable(),
  embedReady: z.boolean(),
  esReady: z.boolean(),
  ownerDeptId: z.string().uuid().nullable().default(null),
  visibilityLevel: VisibilityLevelSchema.default(20),
  docType: z.string().nullable().optional().default(null),
  /** 绑定的分片策略码（只读审计；未记录 = null） */
  chunkStrategy: z.string().nullable().default(null),
  /** 该文档当时的分片参数快照（只读审计；未记录 = null） */
  chunkStrategyParams: z.record(z.string(), z.unknown()).nullable().default(null),
  /** null=未设；[]=显式空名单 */
  aclPrincipals: z.array(z.string().uuid()).nullable().default(null),
  /** 缺省 null = 不限；yyyy-MM-dd HH:mm:ss */
  effectiveFrom: LocalDateTimeStringSchema.nullable().default(null),
  effectiveTo: LocalDateTimeStringSchema.nullable().default(null),
  /** 本文件替代的旧文档；缺省 null = 无替代边 */
  supersedesDocId: z.string().uuid().nullable().default(null),
  /** 被谁替代；缺省 null = 无后继 */
  supersededByDocId: z.string().uuid().nullable().default(null),
});
export type DocumentListItem = z.infer<typeof DocumentListItemSchema>;

/**
 * GET /documents/:docId 公开详情（非 DB 行直出）。
 * 不含 parsedText / 对象内部密钥类字段。
 * 部门字段继承列表项，避免两套默认分叉。
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

/** PATCH /documents/:docId — 部门 / 可见级 / 类型 / 名单 / 生效区间；不改 lifecycle、不入队 */
export const PatchDocumentMetaBodySchema = z
  .object({
    ownerDeptId: z.string().uuid().nullable().optional(),
    visibilityLevel: VisibilityLevelSchema.optional(),
    /** 须属于该 KB 已有枚举；null = 清除分类 */
    docType: z.string().min(1).max(64).nullable().optional(),
    /** omit 不改；null 清回未设；[] 显式空 */
    aclPrincipals: z.array(z.string().uuid()).max(256).nullable().optional(),
    /** omit 不改；null 清除；合法本地时间串 */
    effectiveFrom: LocalDateTimeStringSchema.nullable().optional(),
    effectiveTo: LocalDateTimeStringSchema.nullable().optional(),
  })
  .refine(
    (b) =>
      b.ownerDeptId !== undefined ||
      b.visibilityLevel !== undefined ||
      b.docType !== undefined ||
      b.aclPrincipals !== undefined ||
      b.effectiveFrom !== undefined ||
      b.effectiveTo !== undefined,
    {
      message: 'at least one field',
    },
  );
export type PatchDocumentMetaBody = z.infer<typeof PatchDocumentMetaBodySchema>;

/**
 * 文档 ACL 名单（PRD 05-api §2.4；安全 PRD §3.6.1）。
 * 三态：`null` = 字段缺失 → **成员可读**；`[]` = **成员不可读**；非空 = 仅命中者可读。
 */
export const DocumentAclSchema = z
  .object({
    docId: z.string().uuid(),
    aclPrincipals: z.array(z.string().uuid()).nullable(),
  })
  .strict();
export type DocumentAcl = z.infer<typeof DocumentAclSchema>;

/** PUT /documents/:docId/acl body：与 PATCH 同一三态（`null` 清回缺省、`[]` 显式空） */
export const PutDocumentAclBodySchema = z
  .object({
    aclPrincipals: z.array(z.string().uuid()).max(256).nullable(),
  })
  .strict();
export type PutDocumentAclBody = z.infer<typeof PutDocumentAclBodySchema>;

/**
 * PUT /documents/:docId/acl 响应 = GET 形状 + `reindexRequired`。
 * `aclPrincipals` 是**索引字段**，收紧后 ES 路要等 reindex 才跟上（ADR-009 决策 4 · ES PRD §4.3
 * 「ACL 收紧须 reindex 后确认」）；该信号只在写入那一刻有意义，GET 不回带。
 */
export const PutDocumentAclResponseSchema = DocumentAclSchema.extend({
  reindexRequired: z.boolean(),
});
export type PutDocumentAclResponse = z.infer<typeof PutDocumentAclResponseSchema>;

/**
 * 收紧判定：**新集合不再是旧集合的超集**（有人失去可读性）。
 * `null` = 字段缺失 = 该 KB 全体成员可读；`[]` = 无人可读；非空 = 仅命中者可读。
 * 同一个 `userId` 在旧集合可读、在新集合不可读 → 收紧（`[a] → [b]` 亦算）。
 */
export function aclTightens(
  prev: readonly string[] | null | undefined,
  next: readonly string[] | null | undefined,
): boolean {
  const previous = prev ?? null;
  const upcoming = next ?? null;
  if (previous === null) return upcoming !== null;
  const nextSet = new Set(upcoming ?? []);
  return previous.some((principal) => !nextSet.has(principal));
}

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
