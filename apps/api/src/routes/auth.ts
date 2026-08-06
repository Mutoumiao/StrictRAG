import {
  BizCode,
  DevLoginRequestSchema,
  TokenRefreshRequestSchema,
  type AuthMeResponse,
  type TokenPairResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import {
  AuthIdentityError,
  defaultRoleForApp,
  issueTokenPair,
  refreshTokenPair,
} from '../auth/identity/token-service.js';
import { requireAuth, type AuthVariables } from '../auth/middleware.js';
import {
  canEnterAdminShell,
  resolveEffectiveCodes,
} from '../auth/permissions/resolve.js';
import { env } from '../env.js';
import { fail, ok } from '../lib/response.js';
import { DEV_DEFAULT_TENANT, ensureUserByEmail } from '../services/members.js';

/**
 * 身份路由。
 * - dev-login：仅 development/test；主体 upsert 到 users
 * - refresh：无感续期 + rotation
 * - me：当前主体 + 有效码
 *
 * Better Auth 上线后：/api/auth/* 由 BA 接管登录；
 * 本文件的 refresh/me 可改为 BA session 适配或逐步下线 dev-login。
 */
export const authRoutes = new Hono<{ Variables: AuthVariables }>();

authRoutes.post('/admin/dev-login', async (c) => {
  if (env.APP_ENV !== 'development' && env.APP_ENV !== 'test') {
    return fail(c, BizCode.NOT_FOUND, 'not available', 404);
  }
  const parsed = DevLoginRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const role = defaultRoleForApp('admin', parsed.data.roleTemplate);
  if (role === 'web_consumer') {
    return fail(c, BizCode.FORBIDDEN, 'web_consumer cannot login admin', 403);
  }

  const tenantId = parsed.data.tenantId ?? DEV_DEFAULT_TENANT;
  const user = await ensureUserByEmail({
    email: parsed.data.email,
    tenantId,
    platformRole: role === 'super_admin' ? 'platform_admin' : 'user',
  });

  const pair = await issueTokenPair({
    userId: user.id,
    app: 'admin',
    roles: [role],
    email: user.email,
    tenantId: user.tenantId,
  });

  const effective = resolveEffectiveCodes({ roleCodes: [role] });
  if (!canEnterAdminShell(effective)) {
    return fail(c, BizCode.FORBIDDEN, 'admin.shell required', 403);
  }

  return ok(c, pair as TokenPairResponse, 201);
});

authRoutes.post('/web/dev-login', async (c) => {
  if (env.APP_ENV !== 'development' && env.APP_ENV !== 'test') {
    return fail(c, BizCode.NOT_FOUND, 'not available', 404);
  }
  const parsed = DevLoginRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const role = defaultRoleForApp('web', parsed.data.roleTemplate ?? 'web_consumer');
  const tenantId = parsed.data.tenantId ?? DEV_DEFAULT_TENANT;
  const user = await ensureUserByEmail({
    email: parsed.data.email,
    tenantId,
  });

  const pair = await issueTokenPair({
    userId: user.id,
    app: 'web',
    roles: [role],
    email: user.email,
    tenantId: user.tenantId,
  });
  return ok(c, pair as TokenPairResponse, 201);
});

authRoutes.post('/admin/token/refresh', async (c) => {
  const parsed = TokenRefreshRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }
  try {
    const pair = await refreshTokenPair(parsed.data.refreshToken, 'admin');
    return ok(c, pair as TokenPairResponse);
  } catch (err) {
    const message = err instanceof AuthIdentityError ? err.message : 'refresh failed';
    return fail(c, BizCode.UNAUTHORIZED, message, 401);
  }
});

authRoutes.post('/web/token/refresh', async (c) => {
  const parsed = TokenRefreshRequestSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }
  try {
    const pair = await refreshTokenPair(parsed.data.refreshToken, 'web');
    return ok(c, pair as TokenPairResponse);
  } catch (err) {
    const message = err instanceof AuthIdentityError ? err.message : 'refresh failed';
    return fail(c, BizCode.UNAUTHORIZED, message, 401);
  }
});

authRoutes.get('/me', requireAuth(), async (c) => {
  const auth = c.get('auth');
  const effective = c.get('effectiveCodes');
  if (!auth) {
    return fail(c, BizCode.UNAUTHORIZED, 'unauthorized', 401);
  }
  const data: AuthMeResponse = {
    userId: auth.userId,
    sessionId: auth.sessionId,
    app: auth.app,
    roles: auth.roles,
    tenantId: auth.tenantId,
    email: auth.email,
    permissions: [...effective],
  };
  return ok(c, data);
});
