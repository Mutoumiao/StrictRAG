import { z } from 'zod';

import { GoldTypeSchema } from './gold.contract.js';

export const EvalRunStatusSchema = z.enum(['queued', 'running', 'succeeded', 'failed']);
export type EvalRunStatus = z.infer<typeof EvalRunStatusSchema>;

export const EvalRetrieveModeSchema = z.enum(['mock', 'live', 'unknown']);

export const L1MatrixDtoSchema = z
  .object({
    A: z.number().int().nonnegative(),
    B: z.number().int().nonnegative(),
    C: z.number().int().nonnegative(),
    D: z.number().int().nonnegative(),
  })
  .strict();
export type L1MatrixDto = z.infer<typeof L1MatrixDtoSchema>;

export const EvalRunCaseRowSchema = z
  .object({
    id: z.string().min(1),
    type: GoldTypeSchema,
    outcome: z.enum(['answered', 'abstained', 'error']),
    cell: z.enum(['A', 'B', 'C', 'D']).nullable(),
    reason: z.string().optional(),
    errorMessage: z.string().optional(),
  })
  .strict();
export type EvalRunCaseRow = z.infer<typeof EvalRunCaseRowSchema>;

export const EvalRunSchema = z
  .object({
    runId: z.string().uuid(),
    kbId: z.string().uuid(),
    status: EvalRunStatusSchema,
    runType: z.string().min(1),
    retrieveMode: EvalRetrieveModeSchema,
    signoffEligible: z.boolean(),
    caseCount: z.number().int().nonnegative(),
    matrix: L1MatrixDtoSchema,
    coverage: z.number().nullable(),
    errorCount: z.number().int().nonnegative(),
    ranAt: z.string(),
    jobId: z.string().nullable().optional(),
    errorMessage: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    cases: z.array(EvalRunCaseRowSchema).optional(),
  })
  .strict();
export type EvalRun = z.infer<typeof EvalRunSchema>;

export const CreateEvalRunBodySchema = z
  .object({
    maxCases: z.number().int().positive().max(500).optional(),
    notes: z.string().max(1000).optional(),
  })
  .strict();
export type CreateEvalRunBody = z.infer<typeof CreateEvalRunBodySchema>;

export const CreateEvalRunResponseSchema = z
  .object({
    runId: z.string().uuid(),
    jobId: z.string().nullable(),
    status: z.literal('queued'),
  })
  .strict();
export type CreateEvalRunResponse = z.infer<typeof CreateEvalRunResponseSchema>;

export const EvalRunListResponseSchema = z
  .object({
    items: z.array(EvalRunSchema),
  })
  .strict();
export type EvalRunListResponse = z.infer<typeof EvalRunListResponseSchema>;

export const EvalRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type EvalRunsQuery = z.infer<typeof EvalRunsQuerySchema>;
