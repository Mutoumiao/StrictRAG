import { BizCode } from '@strict-rag/contracts';
import type { Context } from 'hono';
import { createMiddleware } from 'hono/factory';

import { env } from '../env.js';
import { fail } from '../lib/response.js';
import type { ApiVariables } from '../middleware/request-id.js';
import { membersRepo } from '../services/members.js';
import { lookupKbMembership } from './kb-scope.js';
import {
  canAccessKbScoped,
  canEnterAdminShell,
  hasPermission,
  resolveEffectiveCodes,
  roleBypassesKbMembership,
} from './permissions/resolve.js';
import { AuthIdentityError, verifyBearerAccess } from './identity/token-service.js';
import { hydrateAuthz } from './role-hydrate.js';
import type { AuthPrincipal } from './types.js';

export type AuthVariables = ApiVariables;
type AuthCtx = Context<{ Variables: AuthVariables }>;

type ExpectedApp = 'admin' | 'web' | Array<'admin' | 'web'>;

export type ResolveKbMember = (userId: string, kbId: string) => Promise<boolean>;

/** 默认查 kb_members；测例可注入 mock */
export const resolveKbMemberFromDb: ResolveKbMember = (userId, kbId) =>
  membersRepo.isMember(userId, kbId);

/** 请求内成员缓存（懒创建） */
function getKbMemberCache(c: AuthCtx): Map<string, boolean> {
  let cache = c.get('kbMemberCache');
  if (!cache) {
    cache = new Map();
    c.set('kbMemberCache', cache);
  }
  return cache;
}

async function resolveMembershipCached(
  c: AuthCtx,
  userId: string,
  kbId: string,
  resolve: ResolveKbMember,
): Promise<boolean> {
  return lookupKbMembership({
    userId,
    kbId,
    cache: getKbMemberCache(c),
    resolve,
  });
}

function appAllowed(app: AuthPrincipal['app'], expected?: ExpectedApp): boolean {
  if (!expected) return true;
  const list = Array.isArray(expected) ? expected : [expected];
  return list.includes(app);
}

/** JWT 身份 + DB 角色 hydrate（B4-W） */
async function principalFromVerifiedClaims(claims: {
  sub: string;
  sid: string;
  app: AuthPrincipal['app'];
  roles: string[];
  tenantId?: string;
  email?: string;
}): Promise<{ auth: AuthPrincipal; effectiveCodes: Set<string> }> {
  const hydrated = await hydrateAuthz({
    userId: claims.sub,
    tenantId: claims.tenantId,
    claimsRoles: claims.roles,
  });
  const auth: AuthPrincipal = {
    userId: claims.sub,
    sessionId: claims.sid,
    app: claims.app,
    roles: hydrated.roles,
    tenantId: claims.tenantId,
    email: claims.email,
  };
  return { auth, effectiveCodes: hydrated.effectiveCodes };
}

async function ensureAuth(
  c: AuthCtx,
  expectedApp?: ExpectedApp,
): Promise<{ ok: true; auth: AuthPrincipal } | { ok: false; status: 401 | 403; message: string }> {
  let auth = c.get('auth');
  if (!auth) {
    try {
      const claims = await verifyBearerAccess(c.req.header('authorization'), expectedApp);
      const resolved = await principalFromVerifiedClaims(claims);
      auth = resolved.auth;
      c.set('auth', auth);
      c.set('effectiveCodes', resolved.effectiveCodes);
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
    const resolved = await principalFromVerifiedClaims(claims);
    c.set('auth', resolved.auth);
    c.set('effectiveCodes', resolved.effectiveCodes);
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
  /** 默认查 kb_members；单测可注入 */
  resolveKbMember?: ResolveKbMember;
  /**
   * 覆盖 path `:kbId`（handler 从 trace/body 取 kb 时用）。
   * 未传则读 `c.req.param('kbId')`。
   */
  kbId?: string;
};

export type GateResult =
  | { ok: true }
  | { ok: false; status: 401 | 403; message: string; details?: unknown };

/**
 * 验权限码 +（kb scope 时）成员。路径无 `:kbId` 时可用 `options.kbId`。
 * ARCH-P1b-1：成员查询走请求内缓存。
 */
export async function checkPermission(
  c: AuthCtx,
  code: string,
  options?: PermOptions,
): Promise<GateResult> {
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

  const kbId = options?.kbId ?? c.req.param('kbId');
  let isKbMember = true;
  // 有 kbId 时查成员（kb scope 码依赖）；platform 码在 canAccessKbScoped 内忽略成员
  if (kbId) {
    const resolve = options?.resolveKbMember ?? resolveKbMemberFromDb;
    isKbMember = await resolveMembershipCached(c, auth.userId, kbId, resolve);
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

type KbMemberOptions = {
  expectedApp?: ExpectedApp;
  resolveKbMember?: ResolveKbMember;
  /** 覆盖 path `:kbId` */
  kbId?: string;
};

/**
 * 仅成员闸（handler 级 / 无 path kb 时）。super_admin 旁路且不查库。
 * ARCH-P1b-1：走请求内缓存。
 */
export async function evaluateKbMember(
  c: AuthCtx,
  kbId: string,
  options?: { resolveKbMember?: ResolveKbMember },
): Promise<GateResult> {
  const auth = c.get('auth');
  if (!auth) {
    return { ok: false, status: 401, message: 'authentication required' };
  }
  if (roleBypassesKbMembership(auth.roles)) {
    return { ok: true };
  }
  const resolve = options?.resolveKbMember ?? resolveKbMemberFromDb;
  const isMember = await resolveMembershipCached(c, auth.userId, kbId, resolve);
  if (!isMember) {
    return {
      ok: false,
      status: 403,
      message: 'not a knowledge base member',
      details: { kbId },
    };
  }
  return { ok: true };
}

/** 验权限码（ADR-051）。无 auth 时先 ensureAuth。 */
export const requirePermission = (code: string, options?: PermOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const authR = await ensureAuth(c, options?.expectedApp);
    if (!authR.ok) {
      return fail(
        c,
        authR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        authR.message,
        authR.status,
      );
    }
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
 * AUTH_ENFORCE 运行时读取（QUAL-1）：支持测例 `vi.stubEnv` 临时打开并还原。
 * 未设 process.env 时回退模块加载时的 `env.AUTH_ENFORCE`（默认 false，禁止改仓库默认 on）。
 */
export function isAuthEnforceEnabled(): boolean {
  const raw = process.env.AUTH_ENFORCE;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return env.AUTH_ENFORCE;
}

/**
 * AUTH_ENFORCE=true：登录 + 权限码；false：放行（demo-ingest）。
 * 业务入库路由统一挂这个，避免假开关。
 * 打开时 kb scope 走默认 kb_members 校验（与成员 API 同源）。
 */
export const requirePermissionWhenEnforced = (code: string, options?: PermOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    if (!isAuthEnforceEnabled()) {
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

/**
 * ask / sessions 等：始终要求登录 + KB 成员（super_admin 旁路）。
 * 与 AUTH_ENFORCE 无关；demo-ingest 不挂此中间件。
 * ARCH-P1b-1：成员查询请求内缓存。
 */
export const requireKbMember = (options?: KbMemberOptions) =>
  createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
    const authR = await ensureAuth(c, options?.expectedApp);
    if (!authR.ok) {
      return fail(
        c,
        authR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        authR.message,
        authR.status,
      );
    }
    const kbId = options?.kbId ?? c.req.param('kbId');
    if (!kbId) {
      return fail(c, BizCode.VALIDATION_ERROR, 'kbId required', 400);
    }
    const memberR = await evaluateKbMember(c, kbId, {
      resolveKbMember: options?.resolveKbMember,
    });
    if (!memberR.ok) {
      return fail(
        c,
        memberR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        memberR.message,
        memberR.status,
        'details' in memberR ? memberR.details : undefined,
      );
    }
    await next();
  });

export type KbScopeOptions = {
  /**
   * 省略：仅成员（= requireKbMember）。
   * 提供：验码 + kb scope 成员（= requirePermission / WhenEnforced）。
   */
  permission?: string;
  /** true → 对齐 requirePermissionWhenEnforced（AUTH_ENFORCE 关则放行） */
  whenEnforced?: boolean;
  expectedApp?: 'admin' | 'web';
  resolveKbMember?: ResolveKbMember;
};

/**
 * ARCH-P1b-1 · KB 作用域组合入口。
 * 新代码优先用此；既有 requirePermission / requireKbMember / WhenEnforced 仍可用。
 */
export function requireKbScope(options: KbScopeOptions = {}) {
  const { permission, whenEnforced, expectedApp, resolveKbMember } = options;
  if (whenEnforced && !permission) {
    throw new Error('requireKbScope: whenEnforced requires permission');
  }
  if (!permission) {
    return requireKbMember({ expectedApp, resolveKbMember });
  }
  if (whenEnforced) {
    return requirePermissionWhenEnforced(permission, { expectedApp, resolveKbMember });
  }
  return requirePermission(permission, { expectedApp, resolveKbMember });
}
