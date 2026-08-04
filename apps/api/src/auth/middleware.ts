import { BizCode } from '@strict-rag/contracts';
import { createMiddleware } from 'hono/factory';

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

/** 解析 Bearer（可选）：无 token 则 auth=null，不中断 */
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
    const principal: AuthPrincipal = {
      userId: claims.sub,
      sessionId: claims.sid,
      app: claims.app,
      roles: claims.roles,
      tenantId: claims.tenantId,
      email: claims.email,
    };
    c.set('auth', principal);
    c.set('effectiveCodes', resolveEffectiveCodes({ roleCodes: principal.roles }));
  } catch {
    c.set('auth', null);
    c.set('effectiveCodes', new Set());
  }
  await next();
});

/** 必须已登录 */
export const requireAuth = (expectedApp?: 'admin' | 'web' | Array<'admin' | 'web'>) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const authorization = c.req.header('authorization');
    try {
      const claims = await verifyBearerAccess(authorization, expectedApp);
      const principal: AuthPrincipal = {
        userId: claims.sub,
        sessionId: claims.sid,
        app: claims.app,
        roles: claims.roles,
        tenantId: claims.tenantId,
        email: claims.email,
      };
      c.set('auth', principal);
      c.set('effectiveCodes', resolveEffectiveCodes({ roleCodes: principal.roles }));
      await next();
    } catch (err) {
      const message =
        err instanceof AuthIdentityError ? err.message : 'unauthorized';
      return fail(c, BizCode.UNAUTHORIZED, message, 401);
    }
  });

/**
 * 验权限码（ADR-051）。
 * kbId 可选：kb scope 码在提供 kbId 时须成员（超管 bypass）；
 * 当前 isKbMember 默认 true（成员表未全量接入前不误伤 demo），
 * 接入 kb_members 后改为查库。
 */
export const requirePermission = (
  code: string,
  options?: {
    expectedApp?: 'admin' | 'web';
    resolveKbMember?: (userId: string, kbId: string) => Promise<boolean>;
  },
) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }
    if (options?.expectedApp && auth.app !== options.expectedApp) {
      return fail(c, BizCode.FORBIDDEN, 'wrong application context', 403);
    }

    const effective = c.get('effectiveCodes') ?? resolveEffectiveCodes({ roleCodes: auth.roles });
    c.set('effectiveCodes', effective);

    if (code === 'admin.shell' && !canEnterAdminShell(effective)) {
      return fail(c, BizCode.FORBIDDEN, 'admin.shell required', 403);
    }

    const kbId = c.req.param('kbId');
    let isKbMember = true;
    if (kbId && options?.resolveKbMember) {
      isKbMember = await options.resolveKbMember(auth.userId, kbId);
    }

    const ok = canAccessKbScoped({
      roleCodes: auth.roles,
      effective,
      requiredCode: code,
      isKbMember,
    });

    if (!ok) {
      if (!hasPermission(effective, code)) {
        return fail(c, BizCode.FORBIDDEN, `missing permission: ${code}`, 403, {
          code,
        });
      }
      return fail(c, BizCode.FORBIDDEN, 'not a knowledge base member', 403, {
        kbId,
      });
    }

    await next();
  });
