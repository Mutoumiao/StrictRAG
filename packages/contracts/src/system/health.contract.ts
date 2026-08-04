import { z } from 'zod';

/** Phase 0：`GET /health` 响应形状（对齐参考仓 + ADR-028 占位） */
export const HealthResponseSchema = z.object({
  service: z.enum(['api', 'worker']),
  env: z.enum(['development', 'test', 'staging', 'production']),
  status: z.literal('ok'),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** Phase 0：`GET /ready` 依赖探测占位（真探测实现阶段再填） */
export const ReadyResponseSchema = z.object({
  service: z.enum(['api', 'worker']),
  ready: z.boolean(),
  checks: z.record(z.string(), z.enum(['up', 'down', 'skipped'])).optional(),
});

export type ReadyResponse = z.infer<typeof ReadyResponseSchema>;
