import { z } from 'zod';

/** 入库逻辑 stage（物理队列可折叠为单 `sr-ingest`） */
export const INGEST_STAGES = ['scan', 'parse', 'chunk', 'embed', 'es_index'] as const;
export type IngestStage = (typeof INGEST_STAGES)[number];

/**
 * BullMQ ingest job payload（api 入队 + worker 消费 SSOT）。
 * HOW：`.trellis/spec/worker/backend/ingest-idempotency.md`
 */
export const IngestJobDataSchema = z.object({
  docId: z.string().min(1),
  kbId: z.string().min(1),
  tenantId: z.string().min(1),
  stage: z.enum(INGEST_STAGES),
  /** chunk 物化后下游必填；embed/es 幂等键 */
  indexVersion: z.number().int().positive().optional(),
  requestId: z.string().min(1).optional(),
  attemptHint: z.number().int().nonnegative().optional(),
});

export type IngestJobData = z.infer<typeof IngestJobDataSchema>;

/** 入队默认：可重试失败由 worker 矩阵分流；不可重试 → UnrecoverableError */
export const INGEST_JOB_DEFAULT_ATTEMPTS = 3;
export const INGEST_JOB_BACKOFF_MS = 2000;
