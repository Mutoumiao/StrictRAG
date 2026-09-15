import { z } from 'zod';

import { CONTEXT_SOURCES } from './chunk-strategy.js';

/** 跨文档 skip_index 冲突对。pending_review / downrank 不在本形状。 */
export const IngestReportConflictPairSchema = z
  .object({
    otherDocId: z.string().uuid(),
    otherChunkId: z.string().uuid(),
    action: z.literal('skip_index'),
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
    conflictPairs: z.array(IngestReportConflictPairSchema),
    contextSource: z.enum(CONTEXT_SOURCES).nullable(),
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
