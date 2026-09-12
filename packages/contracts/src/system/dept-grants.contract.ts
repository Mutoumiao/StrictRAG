import { z } from 'zod';

import { LocalDateTimeStringSchema } from '../common/local-datetime.js';
import { VisibilityLevelSchema } from '../ingest/document.contract.js';

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
