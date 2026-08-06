import { z } from 'zod';

/** 子站：admin 运营 / web 消费者 */
export const AuthAppSchema = z.enum(['admin', 'web']);
export type AuthApp = z.infer<typeof AuthAppSchema>;

/** 登录/刷新后返回给前端的会话视图（不放密钥） */
export const AuthSessionSchema = z.object({
  sessionId: z.string().min(1),
  userId: z.string().min(1),
  app: AuthAppSchema,
  /** 角色模板码（锚点，非放行条件） */
  roles: z.array(z.string()),
  /** 有效权限码快照（展示/裁剪菜单；API 仍须服务端再验） */
  permissions: z.array(z.string()),
  tenantId: z.string().min(1).optional(),
  email: z.string().email().optional(),
  expiresAtMs: z.number().int().positive(),
});
export type AuthSession = z.infer<typeof AuthSessionSchema>;

/** 双 token 响应（access 短 + refresh 长，对齐参考项目无感刷新） */
export const TokenPairResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresInSec: z.number().int().positive(),
  refreshExpiresInSec: z.number().int().positive(),
  session: AuthSessionSchema,
});
export type TokenPairResponse = z.infer<typeof TokenPairResponseSchema>;

export const TokenRefreshRequestSchema = z.object({
  refreshToken: z.string().min(1),
});
export type TokenRefreshRequest = z.infer<typeof TokenRefreshRequestSchema>;

/** 开发期登录（仅 APP_ENV=development；生产身份切 Better Auth） */
export const DevLoginRequestSchema = z.object({
  email: z.string().email(),
  /** 默认 super_admin（admin）/ web_consumer（web） */
  roleTemplate: z
    .enum(['super_admin', 'kb_admin', 'doc_operator', 'web_consumer'])
    .optional(),
  tenantId: z.string().min(1).optional(),
});
export type DevLoginRequest = z.infer<typeof DevLoginRequestSchema>;

/**
 * GET /api/v1/auth/me 响应 data（无 token；权限以服务端再验为准）。
 * 与 AuthSession 区别：me 带当前 effective permissions 快照，无 expiresAtMs。
 */
export const AuthMeResponseSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  app: AuthAppSchema,
  roles: z.array(z.string()),
  permissions: z.array(z.string()),
  tenantId: z.string().min(1).optional(),
  email: z.string().email().optional(),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
