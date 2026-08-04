import type { AuthApp } from '@strict-rag/contracts';

/** 请求链路身份上下文（中间件写入） */
export type AuthPrincipal = {
  userId: string;
  sessionId: string;
  app: AuthApp;
  /** 角色模板锚点，禁止单独作为放行条件 */
  roles: string[];
  tenantId?: string;
  email?: string;
};

export type AccessTokenClaims = {
  sub: string;
  sid: string;
  app: AuthApp;
  roles: string[];
  tenantId?: string;
  email?: string;
};

export type RefreshTokenClaims = {
  sub: string;
  sid: string;
  app: AuthApp;
  jti: string;
};

export type RefreshTokenRecord = {
  jti: string;
  sessionId: string;
  userId: string;
  app: AuthApp;
  expiresAtMs: number;
  usedAtMs: number | null;
  revokedAtMs: number | null;
  sessionRevokedAtMs: number | null;
  roles: string[];
  tenantId?: string;
  email?: string;
};
