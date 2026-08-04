import { BizCode } from '@strict-rag/contracts';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import { env } from '../env.js';
import { fail } from '../lib/response.js';
import type { ApiVariables } from '../middleware/request-id.js';
import {
  canAccessKbScoped,
  canEnterAdminShell,
  hasPermission,
  resolveEffectiveCodes,
} from './permissions/resolve.js';
import { AuthIdentityError, verifyBearerAccess } from './identity/token-service.js';
import type { AuthPrincipal } from './types.js';

export type AuthVariables = ApiVariables;
type AuthCtx = Context<{ Variables: AuthVariables }>;

type ExpectedApp = 'admin' | 'web' | Array<'admin' | 'web'>;

function principalFromClaims(claims: {
  sub: string;
  sid: string;
  app: AuthPrincipal['app'];
  roles: string[];
  tenantId?: string;
  email?: string;
}): AuthPrincipal {
  return {
    userId: claims.sub,
    sessionId: claims.sid,
    app: claims.app,
    roles: claims.roles,
    tenantId: claims.tenantId,
    email: claims.email,
  };
}

function appAllowed(app: AuthPrincipal['app'], expected?: ExpectedApp): boolean {
  if (!expected) return true;
  const list = Array.isArray(expected) ? expected : [expected];
  return list.includes(app);
}

async function ensureAuth(
  c: AuthCtx,
  expectedApp?: ExpectedApp,
): Promise<{ ok: true; auth: AuthPrincipal } | { ok: false; status: 401 | 403; message: string }> {
  let auth = c.get('auth');
  if (!auth) {
    try {
      const claims = await verifyBearerAccess(c.req.header('authorization'), expectedApp);
      auth = principalFromClaims(claims);
      c.set('auth', auth);
      c.set('effectiveCodes', resolveEffectiveCodes({ roleCodes: auth.roles }));
    } catch (err) {
      const message = err instanceof AuthIdentityError ? err.message : 'unauthorized';
      return { ok: false, status: 401, message };
    }
  } else if (!appAllowed(auth.app, expectedApp)) {
    return { ok: false, status: 403, message: 'wrong application context' };
  }
  return { ok: true, auth };
}

/** 解析 Bearer（可选）：无 token / 无效 → auth=null，不中断 */
export const attachAuthMiddleware = createMiddleware<{
  Variables: AuthVariables;
}>(async (c, next) => {
  const authorization = c.req.header('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    c.set('auth', null);
    c.set('effectiveCodes', new Set());
    await next();
    return;
  }
  try {
    const claims = await verifyBearerAccess(authorization);
    const principal = principalFromClaims(claims);
    c.set('auth', principal);
    c.set('effectiveCodes', resolveEffectiveCodes({ roleCodes: principal.roles }));
  } catch {
    c.set('auth', null);
    c.set('effectiveCodes', new Set());
  }
  await next();
});

/** 必须已登录。优先用 attach 结果；无则再验（无效 token → 401）。 */
export const requireAuth = (expectedApp?: ExpectedApp) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const r = await ensureAuth(c, expectedApp);
    if (!r.ok) {
      return fail(
        c,
        r.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        r.message,
        r.status,
      );
    }
    await next();
  });

type PermOptions = {
  expectedApp?: 'admin' | 'web';
  resolveKbMember?: (userId: string, kbId: string) => Promise<boolean>;
};

async function checkPermission(
  c: AuthCtx,
  code: string,
  options?: PermOptions,
): Promise<{ ok: true } | { ok: false; status: 401 | 403; message: string; details?: unknown }> {
  const auth = c.get('auth');
  if (!auth) {
    return { ok: false, status: 401, message: 'authentication required' };
  }
  if (options?.expectedApp && auth.app !== options.expectedApp) {
    return { ok: false, status: 403, message: 'wrong application context' };
  }

  const effective = c.get('effectiveCodes') ?? resolveEffectiveCodes({ roleCodes: auth.roles });
  c.set('effectiveCodes', effective);

  if (code === 'admin.shell' && !canEnterAdminShell(effective)) {
    return { ok: false, status: 403, message: 'admin.shell required' };
  }

  const kbId = c.req.param('kbId');
  let isKbMember = true;
  if (kbId && options?.resolveKbMember) {
    isKbMember = await options.resolveKbMember(auth.userId, kbId);
  }

  const allowed = canAccessKbScoped({
    roleCodes: auth.roles,
    effective,
    requiredCode: code,
    isKbMember,
  });

  if (!allowed) {
    if (!hasPermission(effective, code)) {
      return {
        ok: false,
        status: 403,
        message: `missing permission: ${code}`,
        details: { code },
      };
    }
    return {
      ok: false,
      status: 403,
      message: 'not a knowledge base member',
      details: { kbId },
    };
  }
  return { ok: true };
}

/** 验权限码（ADR-051）。须已有 auth（或先 requireAuth）。 */
export const requirePermission = (code: string, options?: PermOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const r = await checkPermission(c, code, options);
    if (!r.ok) {
      return fail(
        c,
        r.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        r.message,
        r.status,
        'details' in r ? r.details : undefined,
      );
    }
    await next();
  });

/**
 * AUTH_ENFORCE=true：登录 + 权限码；false：放行（demo-ingest）。
 * 业务入库路由统一挂这个，避免假开关。
 */
export const requirePermissionWhenEnforced = (code: string, options?: PermOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    if (!env.AUTH_ENFORCE) {
      await next();
      return;
    }
    const authR = await ensureAuth(c, options?.expectedApp);
    if (!authR.ok) {
      return fail(
        c,
        authR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        authR.message,
        authR.status,
      );
    }
    const permR = await checkPermission(c, code, options);
    if (!permR.ok) {
      return fail(
        c,
        permR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        permR.message,
        permR.status,
        'details' in permR ? permR.details : undefined,
      );
    }
    await next();
  });
