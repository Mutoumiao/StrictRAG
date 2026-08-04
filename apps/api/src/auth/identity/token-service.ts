import {
  defaultCodesForRoles,
  type RoleTemplateCode,
} from '@strict-rag/admin-catalog';
import type { AuthApp, AuthSession, TokenPairResponse } from '@strict-rag/contracts';
import { uuidv7 } from 'uuidv7';

import { env } from '../../env.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
} from './jwt.js';
import {
  getRefreshToken,
  markRefreshUsed,
  putRefreshToken,
  revokeSession,
} from './refresh-store.js';

export class AuthIdentityError extends Error {
  constructor(
    readonly code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'INVALID_CREDENTIALS',
    message: string,
  ) {
    super(message);
    this.name = 'AuthIdentityError';
  }
}

function accessTtl() {
  return env.ACCESS_TOKEN_TTL_SEC;
}
function refreshTtl() {
  return env.REFRESH_TOKEN_TTL_SEC;
}

export async function issueTokenPair(params: {
  userId: string;
  app: AuthApp;
  roles: string[];
  tenantId?: string;
  email?: string;
  sessionId?: string;
}): Promise<TokenPairResponse> {
  const nowMs = Date.now();
  const sessionId = params.sessionId ?? uuidv7();
  const expiresAtMs = nowMs + refreshTtl() * 1000;
  const permissions = [...defaultCodesForRoles(params.roles)];

  const accessToken = await signAccessToken({
    claims: {
      sub: params.userId,
      sid: sessionId,
      app: params.app,
      roles: params.roles,
      tenantId: params.tenantId,
      email: params.email,
    },
    secret: env.JWT_ACCESS_SECRET,
    ttlSec: accessTtl(),
  });

  const refresh = await signRefreshToken({
    claims: {
      sub: params.userId,
      sid: sessionId,
      app: params.app,
    },
    secret: env.JWT_REFRESH_SECRET,
    ttlSec: refreshTtl(),
  });

  putRefreshToken({
    jti: refresh.jti,
    sessionId,
    userId: params.userId,
    app: params.app,
    expiresAtMs,
    usedAtMs: null,
    revokedAtMs: null,
    sessionRevokedAtMs: null,
    roles: params.roles,
    tenantId: params.tenantId,
    email: params.email,
  });

  const session: AuthSession = {
    sessionId,
    userId: params.userId,
    app: params.app,
    roles: params.roles,
    permissions,
    tenantId: params.tenantId,
    email: params.email,
    expiresAtMs,
  };

  return {
    accessToken,
    refreshToken: refresh.token,
    tokenType: 'Bearer',
    expiresInSec: accessTtl(),
    refreshExpiresInSec: refreshTtl(),
    session,
  };
}

export async function refreshTokenPair(
  refreshToken: string,
  expectedApp?: AuthApp,
): Promise<TokenPairResponse> {
  let claims;
  try {
    claims = await verifyRefreshToken({
      token: refreshToken,
      secret: env.JWT_REFRESH_SECRET,
      expectedApp,
    });
  } catch {
    throw new AuthIdentityError('UNAUTHORIZED', 'refresh token invalid');
  }

  const nowMs = Date.now();
  const row = getRefreshToken(claims.jti);
  if (!row || row.sessionId !== claims.sid || row.userId !== claims.sub) {
    throw new AuthIdentityError('UNAUTHORIZED', 'refresh token not found');
  }
  if (expectedApp && row.app !== expectedApp) {
    throw new AuthIdentityError('UNAUTHORIZED', 'refresh token app mismatch');
  }
  if (row.sessionRevokedAtMs !== null) {
    throw new AuthIdentityError('UNAUTHORIZED', 'session revoked');
  }
  if (row.revokedAtMs !== null || row.expiresAtMs <= nowMs) {
    throw new AuthIdentityError('UNAUTHORIZED', 'refresh token expired');
  }
  if (row.usedAtMs !== null) {
    revokeSession(row.sessionId, nowMs);
    throw new AuthIdentityError('UNAUTHORIZED', 'refresh token replay');
  }

  const marked = markRefreshUsed(claims.jti, nowMs);
  if (!marked) {
    revokeSession(row.sessionId, nowMs);
    throw new AuthIdentityError('UNAUTHORIZED', 'refresh token replay');
  }

  // 续签时重算角色绑码（授码变更下次 refresh 生效）
  return issueTokenPair({
    userId: row.userId,
    app: row.app,
    roles: row.roles,
    tenantId: row.tenantId,
    email: row.email,
    sessionId: row.sessionId,
  });
}

export async function verifyBearerAccess(
  authorization: string | undefined,
  expectedApp?: AuthApp | AuthApp[],
) {
  if (!authorization?.startsWith('Bearer ')) {
    throw new AuthIdentityError('UNAUTHORIZED', 'access token required');
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new AuthIdentityError('UNAUTHORIZED', 'access token required');
  }
  try {
    return await verifyAccessToken({
      token,
      secret: env.JWT_ACCESS_SECRET,
      expectedApp,
    });
  } catch {
    throw new AuthIdentityError('UNAUTHORIZED', 'access token invalid');
  }
}

export function defaultRoleForApp(
  app: AuthApp,
  roleTemplate?: RoleTemplateCode,
): RoleTemplateCode {
  if (roleTemplate) return roleTemplate;
  return app === 'admin' ? 'super_admin' : 'web_consumer';
}
