/**
 * 剧本 E4 · PRD 04 §5.1 / 数据 PRD §3.2：跨 doc 去重的**人工二选一**。
 *
 * 状态机极简：`dedupe_status = 'pending_review'`（待审）→ 处理完回 `NULL`（不再待审）。
 * 不发明第三个枚举值。
 */

import { z } from 'zod';

export const DedupeConflictWinnerSchema = z.enum(['this', 'other']);
export type DedupeConflictWinner = z.infer<typeof DedupeConflictWinnerSchema>;

/** POST …/documents/:docId/dedupe-conflicts/:chunkId/resolve */
export const ResolveDedupeConflictBodySchema = z
  .object({ winner: DedupeConflictWinnerSchema })
  .strict();
export type ResolveDedupeConflictBody = z.infer<typeof ResolveDedupeConflictBodySchema>;

export const ResolveDedupeConflictResponseSchema = z
  .object({
    docId: z.string().uuid(),
    chunkId: z.string().uuid(),
    winner: DedupeConflictWinnerSchema,
    /**
     * `winner='this'` 时 true：本块已不再是待审重复，**须由持 `doc.reindex` 的人重新入库**才会进检索；
     * 本端点**不**代跑 reindex（不做权限升级）。
     */
    reindexRequired: z.boolean(),
  })
  .strict();
export type ResolveDedupeConflictResponse = z.infer<typeof ResolveDedupeConflictResponseSchema>;
