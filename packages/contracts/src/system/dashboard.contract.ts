import { z } from 'zod';

/**
 * B6 数据面板 summary（只读 · ≤5 指标）。
 * askCount24h 可选：traces 可廉价 count 时下发。
 */
export const DashboardSummarySchema = z
  .object({
    kbCount: z.number().int().nonnegative(),
    documentCount: z.number().int().nonnegative(),
    pendingApprovalCount: z.number().int().nonnegative(),
    processReady: z.boolean(),
    askCount24h: z.number().int().nonnegative().optional(),
  })
  .strict();

export type DashboardSummary = z.infer<typeof DashboardSummarySchema>;
