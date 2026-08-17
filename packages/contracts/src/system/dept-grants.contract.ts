import { z } from 'zod';

import { VisibilityLevelSchema } from '../ingest/document.contract.js';

/** 与 formatLocalDateTime 对齐；乱字符串会在 PG timestamp 上 500 */
export const LocalDateTimeStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'expected yyyy-MM-dd HH:mm:ss');

/** GET 跨部门授权（表 CRUD；enforce 开时 retrieve 可读精确 grant） */
export const DeptCrossGrantSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  deptId: z.string().uuid(),
  maxVisibilityLevel: VisibilityLevelSchema,
  expiresAt: z.string().nullable(),
  reason: z.string().nullable().optional(),
  grantedBy: z.string().uuid().nullable().optional(),
  grantedAt: z.string(),
});
export type DeptCrossGrant = z.infer<typeof DeptCrossGrantSchema>;

export const CreateDeptCrossGrantBodySchema = z
  .object({
    userId: z.string().uuid(),
    deptId: z.string().uuid(),
    maxVisibilityLevel: VisibilityLevelSchema,
    expiresAt: LocalDateTimeStringSchema.nullable().optional(),
    reason: z.string().optional(),
  })
  .strict();
export type CreateDeptCrossGrantBody = z.infer<typeof CreateDeptCrossGrantBodySchema>;

export const ListDeptCrossGrantsQuerySchema = z
  .object({
    userId: z.string().uuid().optional(),
    deptId: z.string().uuid().optional(),
  })
  .strict();
export type ListDeptCrossGrantsQuery = z.infer<typeof ListDeptCrossGrantsQuerySchema>;
