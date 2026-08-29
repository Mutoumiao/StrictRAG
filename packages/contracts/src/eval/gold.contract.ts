import { z } from 'zod';

import { GOLD_TYPES } from './l1-matrix.js';

export const GoldTypeSchema = z.enum(GOLD_TYPES);

export const GoldQuestionSchema = z
  .object({
    id: z.string().uuid(),
    kbId: z.string().uuid(),
    caseKey: z.string().min(1).max(128),
    question: z.string().min(1).max(8000),
    type: GoldTypeSchema,
    expectedDocIds: z.array(z.string().min(1)).max(64).nullable().optional(),
    expectedChunkIds: z.array(z.string().min(1)).max(64).nullable().optional(),
    rubric: z.string().max(4000).nullable().optional(),
    createdAt: z.string().nullable().optional(),
    updatedAt: z.string().nullable().optional(),
  })
  .strict();
export type GoldQuestion = z.infer<typeof GoldQuestionSchema>;

export const CreateGoldQuestionBodySchema = z
  .object({
    caseKey: z.string().min(1).max(128),
    question: z.string().min(1).max(8000),
    type: GoldTypeSchema,
    expectedDocIds: z.array(z.string().min(1)).max(64).optional(),
    expectedChunkIds: z.array(z.string().min(1)).max(64).optional(),
    rubric: z.string().max(4000).optional(),
  })
  .strict();
export type CreateGoldQuestionBody = z.infer<typeof CreateGoldQuestionBodySchema>;

export const PatchGoldQuestionBodySchema = z
  .object({
    caseKey: z.string().min(1).max(128).optional(),
    question: z.string().min(1).max(8000).optional(),
    type: GoldTypeSchema.optional(),
    expectedDocIds: z.array(z.string().min(1)).max(64).nullable().optional(),
    expectedChunkIds: z.array(z.string().min(1)).max(64).nullable().optional(),
    rubric: z.string().max(4000).nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'empty patch' });
export type PatchGoldQuestionBody = z.infer<typeof PatchGoldQuestionBodySchema>;

export const GoldQuestionListResponseSchema = z
  .object({
    items: z.array(GoldQuestionSchema),
  })
  .strict();
export type GoldQuestionListResponse = z.infer<typeof GoldQuestionListResponseSchema>;

export const GoldQuestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});
export type GoldQuestionsQuery = z.infer<typeof GoldQuestionsQuerySchema>;
