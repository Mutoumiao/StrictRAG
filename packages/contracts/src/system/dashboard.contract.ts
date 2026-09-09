import { z } from 'zod';

import { EvalRetrieveModeSchema, L1MatrixDtoSchema } from '../eval/eval-run.contract.js';

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

/**
 * I4 双轨：质量 / 延迟。独立信封，禁止塞进 B6 summary。
 * 质量来自最近一笔成功 L1 工程账本，≠ 准出 PASS。
 */
export const DashboardQualityTrackSchema = z
  .object({
    evalRunId: z.string().uuid().nullable(),
    retrieveMode: EvalRetrieveModeSchema.nullable(),
    matrix: L1MatrixDtoSchema.nullable(),
    coverage: z.number().nullable(),
    hitAtK: z.number().nullable(),
    tauStar: z.number().nullable(),
    judgeAuroc: z.number().nullable(),
  })
  .strict();
export type DashboardQualityTrack = z.infer<typeof DashboardQualityTrackSchema>;

export const DashboardLatencyTrackSchema = z
  .object({
    windowHours: z.literal(24),
    askCount: z.number().int().nonnegative(),
    scoredCount: z.number().int().nonnegative(),
    avgMs: z.number().int().nullable(),
    p95Ms: z.number().int().nullable(),
  })
  .strict();
export type DashboardLatencyTrack = z.infer<typeof DashboardLatencyTrackSchema>;

export const DashboardTracksSchema = z
  .object({
    quality: DashboardQualityTrackSchema,
    latency: DashboardLatencyTrackSchema,
  })
  .strict();
export type DashboardTracks = z.infer<typeof DashboardTracksSchema>;
