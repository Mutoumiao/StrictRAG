import { z } from 'zod';

import { CONTEXT_SOURCES } from './chunk-strategy.js';
import { CrossDocDedupeActionSchema } from '../kb/kb-settings.contract.js';

/**
 * 跨文档去重冲突对（PRD 04 §5.1）。
 * `action` 取 KB 策略的动作；`pending_review` 时带 `heldChunkId` = 被拦下入审的**本块** id
 * （运营从报告点开冲突对 → 拿它调 resolve 端点）。
 */
export const IngestReportConflictPairSchema = z
  .object({
    otherDocId: z.string().uuid(),
    otherChunkId: z.string().uuid(),
    action: CrossDocDedupeActionSchema,
    heldChunkId: z.string().uuid().optional(),
  })
  .strict();
export type IngestReportConflictPair = z.infer<typeof IngestReportConflictPairSchema>;

/** GET /api/v1/knowledge-bases/:kbId/ingest-report 列表项。只含已发生事实。 */
export const IngestReportItemSchema = z
  .object({
    id: z.string().uuid(),
    kbId: z.string().uuid(),
    docId: z.string().uuid(),
    indexVersion: z.number().int(),
    chunkCount: z.number().int().nonnegative(),
    internalDropped: z.number().int().nonnegative(),
    crossDocDropped: z.number().int().nonnegative(),
    /**
     * 跨文档去重率（PRD 04 §5.2 `dedupe_cross_doc_rate`）。
     * 口径（本仓钉，PRD 只给指标名）：`crossDocDropped / (chunkCount + internalDropped + crossDocDropped)`；
     * **null = 分母为 0**（本轮没有参与去重的切片），不得读成「零重复」。
     */
    dedupeCrossDocRate: z.number().min(0).max(1).nullable(),
    conflictPairs: z.array(IngestReportConflictPairSchema),
    contextSource: z.enum(CONTEXT_SOURCES).nullable(),
    /**
     * `contextualize_l1_ok` / `contextualize_l0_fallback`（PRD 04 §5.2「指标（入库报告必出）」）。
     * **null = 未记录**（迁移前旧行）；L1 未开启的本轮为 0，须与 `contextSource` 一并判读。
     */
    contextualizeL1Ok: z.number().int().nonnegative().nullable(),
    contextualizeL0Fallback: z.number().int().nonnegative().nullable(),
    dualReady: z.boolean(),
    embedReady: z.boolean(),
    esReady: z.boolean(),
    reconcile: z
      .object({
        ok: z.boolean(),
        missingCount: z.number().int().nonnegative(),
        orphanCount: z.number().int().nonnegative(),
      })
      .nullable(),
    createdAt: z.string().nullable().optional(),
  })
  .strict();
export type IngestReportItem = z.infer<typeof IngestReportItemSchema>;
