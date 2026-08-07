import { z } from 'zod';

/** 部门状态 */
export const DepartmentStatusSchema = z.enum(['active', 'disabled']);
export type DepartmentStatus = z.infer<typeof DepartmentStatusSchema>;

/** GET 部门 */
export const DepartmentSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid().nullable(),
  name: z.string().min(1).max(200),
  code: z.string().max(64).nullable().optional(),
  sort: z.number().int(),
  status: DepartmentStatusSchema,
  path: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type Department = z.infer<typeof DepartmentSchema>;

export const CreateDepartmentBodySchema = z
  .object({
    name: z.string().min(1).max(200),
    parentId: z.string().uuid().nullable().optional(),
    code: z.string().max(64).nullable().optional(),
    sort: z.number().int().optional(),
  })
  .strict();
export type CreateDepartmentBody = z.infer<typeof CreateDepartmentBodySchema>;

export const PatchDepartmentBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    parentId: z.string().uuid().nullable().optional(),
    code: z.string().max(64).nullable().optional(),
    sort: z.number().int().optional(),
    status: DepartmentStatusSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个可写字段' });
export type PatchDepartmentBody = z.infer<typeof PatchDepartmentBodySchema>;

/** 树节点 */
export const DepartmentTreeNodeSchema: z.ZodType<DepartmentTreeNode> = z.lazy(() =>
  DepartmentSchema.extend({
    children: z.array(DepartmentTreeNodeSchema),
  }),
);
export type DepartmentTreeNode = Department & { children: DepartmentTreeNode[] };

/** 用户部门归属一条 */
export const UserDepartmentAssignmentSchema = z.object({
  deptId: z.string().uuid(),
  isPrimary: z.boolean(),
  isLeader: z.boolean(),
  title: z.string().max(100).nullable().optional(),
  deptName: z.string().optional(),
});
export type UserDepartmentAssignment = z.infer<typeof UserDepartmentAssignmentSchema>;

export const PutUserDepartmentsBodySchema = z
  .object({
    assignments: z.array(
      z
        .object({
          deptId: z.string().uuid(),
          isPrimary: z.boolean(),
          isLeader: z.boolean().optional().default(false),
          title: z.string().max(100).nullable().optional(),
        })
        .strict(),
    ),
  })
  .strict();
export type PutUserDepartmentsBody = z.infer<typeof PutUserDepartmentsBodySchema>;

export const UserDepartmentsViewSchema = z.object({
  userId: z.string().uuid(),
  assignments: z.array(UserDepartmentAssignmentSchema),
});
export type UserDepartmentsView = z.infer<typeof UserDepartmentsViewSchema>;
