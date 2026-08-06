import { z } from 'zod';

/** 库内角色锚点（与平台 roles 分离） */
export const KbMemberRoleSchema = z.enum(['read', 'write', 'admin']);
export type KbMemberRole = z.infer<typeof KbMemberRoleSchema>;

export const InviteMemberBodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    role: KbMemberRoleSchema.default('read'),
  })
  .strict()
  .refine((v) => Boolean(v.userId || v.email), {
    message: '须提供 userId 或 email',
  });

export type InviteMemberBody = z.infer<typeof InviteMemberBodySchema>;

export const KbMemberSchema = z.object({
  kbId: z.string().uuid(),
  userId: z.string().uuid(),
  role: KbMemberRoleSchema,
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  createdAt: z.string().optional(),
});

export type KbMember = z.infer<typeof KbMemberSchema>;

/** GET …/members — data 为数组（无额外包装） */
export type KbMemberListResponse = KbMember[];

/** POST …/knowledge-bases/:kbId/members */
export const InviteMemberResponseSchema = z.object({
  kbId: z.string().uuid(),
  userId: z.string().uuid(),
  role: KbMemberRoleSchema,
});
export type InviteMemberResponse = z.infer<typeof InviteMemberResponseSchema>;

/** DELETE …/knowledge-bases/:kbId/members/:userId */
export const RemoveMemberResponseSchema = z.object({
  kbId: z.string().uuid(),
  userId: z.string().uuid(),
  removed: z.boolean(),
});
export type RemoveMemberResponse = z.infer<typeof RemoveMemberResponseSchema>;
