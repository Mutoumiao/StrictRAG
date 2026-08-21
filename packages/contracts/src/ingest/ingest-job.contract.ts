import { z } from 'zod';

/** GET …/documents/:docId/ingest-jobs 只读行 */
export const IngestJobListItemSchema = z.object({
  id: z.string().uuid(),
  docId: z.string().uuid(),
  jobName: z.string().min(1),
  status: z.string().min(1),
  errorMessage: z.string().nullable().optional(),
  indexVersion: z.number().int().nullable().optional(),
  createdAt: z.string().nullable().optional(),
});
export type IngestJobListItem = z.infer<typeof IngestJobListItemSchema>;
