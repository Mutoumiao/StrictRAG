/**
 * ARCH-P1b-1 · KB 作用域成员查询（纯函数 + 请求内缓存）。
 * 中间件 / handler 共用，禁止 route 私写 resolve + bypass。
 */

export type ResolveKbMemberFn = (userId: string, kbId: string) => Promise<boolean>;

/** 请求内 Map 的 key：userId + kbId */
export function membershipCacheKey(userId: string, kbId: string): string {
  return `${userId}\0${kbId}`;
}

/**
 * 同 (userId, kbId) 在同一 cache 内只调用一次 resolve。
 */
export async function lookupKbMembership(params: {
  userId: string;
  kbId: string;
  cache: Map<string, boolean>;
  resolve: ResolveKbMemberFn;
}): Promise<boolean> {
  const key = membershipCacheKey(params.userId, params.kbId);
  if (params.cache.has(key)) {
    return params.cache.get(key)!;
  }
  const value = await params.resolve(params.userId, params.kbId);
  params.cache.set(key, value);
  return value;
}
