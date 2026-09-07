import { z } from 'zod';

/** GET /api/v1/knowledge-bases/:kbId/settings-audit 列表项。禁止密钥字段。 */
export const KbSettingsAuditDiffChangeSchema = z
  .object({
    from: z.unknown(),
    to: z.unknown(),
  })
  .strict();
export type KbSettingsAuditDiffChange = z.infer<typeof KbSettingsAuditDiffChangeSchema>;

export const KbSettingsAuditDiffSchema = z.record(z.string(), KbSettingsAuditDiffChangeSchema);
export type KbSettingsAuditDiff = z.infer<typeof KbSettingsAuditDiffSchema>;

export const KbSettingsAuditItemSchema = z
  .object({
    id: z.string().uuid(),
    kbId: z.string().uuid(),
    actorUserId: z.string().min(1),
    createdAt: z.string().nullable().optional(),
    diff: KbSettingsAuditDiffSchema,
  })
  .strict();
export type KbSettingsAuditItem = z.infer<typeof KbSettingsAuditItemSchema>;
