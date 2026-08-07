import { z } from 'zod';

/** 平台用户状态 */
export const PlatformUserStatusSchema = z.enum(['active', 'disabled']);
export type PlatformUserStatus = z.infer<typeof PlatformUserStatusSchema>;

/** GET 平台用户（运营账号） */
export const PlatformUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable().optional(),
  status: PlatformUserStatusSchema,
  isPlatformOperator: z.boolean(),
  roleIds: z.array(z.string().uuid()),
  roleCodes: z.array(z.string()),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type PlatformUser = z.infer<typeof PlatformUserSchema>;

export const CreatePlatformUserBodySchema = z
  .object({
    email: z.string().email().max(320),
    displayName: z.string().max(200).nullable().optional(),
    status: PlatformUserStatusSchema.optional(),
    roleIds: z.array(z.string().uuid()).optional(),
  })
  .strict();
export type CreatePlatformUserBody = z.infer<typeof CreatePlatformUserBodySchema>;

export const PatchPlatformUserBodySchema = z
  .object({
    displayName: z.string().max(200).nullable().optional(),
    status: PlatformUserStatusSchema.optional(),
    roleIds: z.array(z.string().uuid()).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个可写字段' });
export type PatchPlatformUserBody = z.infer<typeof PatchPlatformUserBodySchema>;

export const AssignUserRolesBodySchema = z
  .object({
    roleIds: z.array(z.string().uuid()),
  })
  .strict();
export type AssignUserRolesBody = z.infer<typeof AssignUserRolesBodySchema>;

/** 平台角色 */
export const PlatformRoleSchema = z.object({
  id: z.string().uuid(),
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  isSystem: z.boolean(),
  enabled: z.boolean(),
  codes: z.array(z.string()),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});
export type PlatformRole = z.infer<typeof PlatformRoleSchema>;

const roleCodeSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'role code must be snake_case lowercase');

export const CreatePlatformRoleBodySchema = z
  .object({
    code: roleCodeSchema,
    name: z.string().min(1).max(200),
    codes: z.array(z.string()).optional(),
    enabled: z.boolean().optional(),
  })
  .strict();
export type CreatePlatformRoleBody = z.infer<typeof CreatePlatformRoleBodySchema>;

export const PatchPlatformRoleBodySchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    enabled: z.boolean().optional(),
    codes: z.array(z.string()).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: '至少提供一个可写字段' });
export type PatchPlatformRoleBody = z.infer<typeof PatchPlatformRoleBodySchema>;

export const PutRolePermissionsBodySchema = z
  .object({
    codes: z.array(z.string()),
  })
  .strict();
export type PutRolePermissionsBody = z.infer<typeof PutRolePermissionsBodySchema>;

/** 权限目录项（与 admin-catalog 对齐，无密钥） */
export const PermissionCatalogItemSchema = z.object({
  code: z.string(),
  kind: z.enum(['page', 'action', 'page+action']),
  scope: z.enum(['platform', 'kb']),
  description: z.string(),
});
export type PermissionCatalogItem = z.infer<typeof PermissionCatalogItemSchema>;
