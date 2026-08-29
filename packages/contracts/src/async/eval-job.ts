import { z } from 'zod';

import { EvalRetrieveModeSchema } from '../eval/eval-run.contract.js';

/**
 * BullMQ eval.run job payload（api 入队 + worker 消费 SSOT）。
 * 本底线只跑 L1 golden_2x2；τ 扫描 / 校准 / 在线抽样不进本 payload。
 */
export const EvalJobDataSchema = z
  .object({
    tenantId: z.string().uuid(),
    kbId: z.string().uuid(),
    runId: z.string().uuid(),
    userId: z.string().uuid(),
    retrieveMode: EvalRetrieveModeSchema,
    requestId: z.string().min(1).optional(),
    maxCases: z.number().int().positive().max(500).optional(),
  })
  .strict();
export type EvalJobData = z.infer<typeof EvalJobDataSchema>;

/** 整批重试成本高；失败写 eval_runs.status=failed，人工再入队 */
export const EVAL_JOB_DEFAULT_ATTEMPTS = 1;
export const EVAL_JOB_NAME = 'golden_2x2';
