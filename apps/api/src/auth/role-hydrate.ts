import { defaultCodesForRoles } from '@strict-rag/admin-catalog';

import { env } from '../env.js';
import { DEV_DEFAULT_TENANT } from '../services/members.js';
import {
  platformUsersRolesRepo,
  type PlatformUsersRolesRepo,
} from '../services/platform-users-roles.js';

/**
 * B4-W：身份来自 JWT；授权角色/码每请求 DB hydrate。
 *
 * 缓存假设（单实例）：
 * - 进程内 Map，TTL ≤5s；写路径须 `invalidateRoleCache(userId)`。
 * - 多实例：无共享失效 → 最多 ~5s 脏读；需 Redis 广播或接受 TTL。
 */
export const ROLE_CACHE_TTL_MS = 5_000;

export type HydratedAuthz = {
  roles: string[];
  effectiveCodes: Set<string>;
  /** db = 权威；claims = 回退（dev/test 空绑 或 loader 不可用） */
  source: 'db' | 'claims';
};

/**
 * 加载用户启用中角色码与权限码并集。
 * - 返回 `null`：保持 JWT claims（loader 跳过 / 不可用）
 * - 返回 `{ roles, codes }`：DB 权威（roles/codes 均可为空数组）
 */
export type RoleAuthzLoader = (
  userId: string,
  tenantId: string,
) => Promise<{ roles: string[]; codes: string[] } | null>;

type CacheEntry = {
  roles: string[];
  codes: string[];
  expiresAt: number;
};

const cache = new Map<string, CacheEntry>();

let loader: RoleAuthzLoader = createDbRoleAuthzLoader(platformUsersRolesRepo);

/** 写路径 / 测例：按用户失效；无参清空全表。 */
export function invalidateRoleCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/** 测例注入；传 null 恢复默认 DB loader。 */
export function setRoleAuthzLoader(next: RoleAuthzLoader | null): void {
  loader = next ?? createDbRoleAuthzLoader(platformUsersRolesRepo);
  invalidateRoleCache();
}

export function createDbRoleAuthzLoader(repo: PlatformUsersRolesRepo): RoleAuthzLoader {
  return async (userId, tenantId) => {
    await repo.ensureSystemRoles(tenantId);
    const roleIds = await repo.listRoleIdsForUser(userId);
    if (roleIds.length === 0) {
      // 无任何绑定：生产视为空权限；dev/test 交由 hydrate 回退 claims（兼容 JWT 单测）
      return { roles: [], codes: [] };
    }
    const roles: string[] = [];
    const codeSet = new Set<string>();
    for (const rid of roleIds) {
      const row = await repo.getRole(tenantId, rid);
      if (!row || row.enabled !== 1) continue;
      roles.push(row.code);
      for (const c of row.codesJson) codeSet.add(c);
    }
    return { roles, codes: [...codeSet] };
  };
}

function claimsAuthz(claimsRoles: string[]): HydratedAuthz {
  return {
    roles: [...claimsRoles],
    effectiveCodes: defaultCodesForRoles(claimsRoles),
    source: 'claims',
  };
}

function allowClaimsFallback(): boolean {
  return env.APP_ENV === 'development' || env.APP_ENV === 'test';
}

/**
 * 解析主体角色与有效权限码（带 ≤5s 缓存）。
 */
export async function hydrateAuthz(params: {
  userId: string;
  tenantId?: string;
  claimsRoles: string[];
  nowMs?: number;
}): Promise<HydratedAuthz> {
  const tenantId = params.tenantId ?? DEV_DEFAULT_TENANT;
  const now = params.nowMs ?? Date.now();
  const hit = cache.get(params.userId);
  if (hit && hit.expiresAt > now) {
    return {
      roles: hit.roles,
      effectiveCodes: new Set(hit.codes),
      source: 'db',
    };
  }

  try {
    const loaded = await loader(params.userId, tenantId);
    if (loaded === null) {
      return claimsAuthz(params.claimsRoles);
    }
    // 无绑定且允许回退：JWT 单测 / 未走 B4 管理面
    if (loaded.roles.length === 0 && loaded.codes.length === 0 && allowClaimsFallback()) {
      return claimsAuthz(params.claimsRoles);
    }
    cache.set(params.userId, {
      roles: loaded.roles,
      codes: loaded.codes,
      expiresAt: now + ROLE_CACHE_TTL_MS,
    });
    return {
      roles: loaded.roles,
      effectiveCodes: new Set(loaded.codes),
      source: 'db',
    };
  } catch {
    // DB 不可用：不阻断身份；回退 claims
    return claimsAuthz(params.claimsRoles);
  }
}

/**
 * bootstrap：确保用户持有指定角色码（dev-login / 测超管）。
 * 幂等：已有则跳过。
 */
export async function ensureUserRoleCodes(params: {
  userId: string;
  tenantId?: string;
  roleCodes: readonly string[];
  repo?: PlatformUsersRolesRepo;
}): Promise<string[]> {
  const repo = params.repo ?? platformUsersRolesRepo;
  const tenantId = params.tenantId ?? DEV_DEFAULT_TENANT;
  await repo.ensureSystemRoles(tenantId);
  const all = await repo.listRoles(tenantId);
  const byCode = new Map(all.map((r) => [r.code, r]));
  const roleIds: string[] = [];
  for (const code of params.roleCodes) {
    const row = byCode.get(code);
    if (!row) {
      throw new Error(`role_code_not_found:${code}`);
    }
    roleIds.push(row.id);
  }
  await repo.setUserRoles(tenantId, params.userId, roleIds);
  invalidateRoleCache(params.userId);
  return roleIds;
}
