import { z } from 'zod';

/** GET …/documents/:docId/chunks 查询（ADR-052） */
export const ChunkListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** 上一页末条 ordinal；首屏省略 */
  cursor: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : v),
    z.coerce.number().int().min(0).optional(),
  ),
});
export type ChunkListQuery = z.infer<typeof ChunkListQuerySchema>;

/** 列表项：截断 preview，禁止 body */
export const ChunkListItemSchema = z.object({
  chunkId: z.string().uuid(),
  ordinal: z.number().int().nonnegative(),
  preview: z.string(),
  previewTruncated: z.boolean(),
  searchable: z.boolean().optional(),
  indexVersion: z.number().int(),
  tokenCount: z.number().int().nullable().optional(),
});
export type ChunkListItem = z.infer<typeof ChunkListItemSchema>;

/** GET …/chunks 成功 data */
export const ChunkListResponseSchema = z.object({
  docId: z.string().uuid(),
  indexVersion: z.number().int(),
  /** 文档管线态（UI 标注不可检索，禁止伪装「已上线」） */
  status: z.string().optional(),
  lifecycle: z.string().optional(),
  items: z.array(ChunkListItemSchema),
  nextCursor: z.string().nullable(),
});
export type ChunkListResponse = z.infer<typeof ChunkListResponseSchema>;

/** GET …/chunks/:chunkId 详情：含 body */
export const ChunkDetailSchema = ChunkListItemSchema.extend({
  body: z.string(),
  bodyTruncated: z.boolean(),
});
export type ChunkDetail = z.infer<typeof ChunkDetailSchema>;
