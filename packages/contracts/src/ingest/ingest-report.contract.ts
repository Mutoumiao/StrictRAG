import { z } from 'zod';

/** GET /api/v1/knowledge-bases/:kbId/ingest-report 列表项。只含已发生事实。 */
export const IngestReportItemSchema = z
  .object({
    id: z.string().uuid(),
    kbId: z.string().uuid(),
    docId: z.string().uuid(),
    indexVersion: z.number().int(),
    chunkCount: z.number().int().nonnegative(),
    internalDropped: z.number().int().nonnegative(),
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
