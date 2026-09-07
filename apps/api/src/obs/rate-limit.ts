/**
 * 三平面配额：ask / ingest 独立固定窗口（每分钟）；aux 只留常量、不跑。
 * ASK_RATE_LIMIT_RPM / INGEST_RATE_LIMIT_RPM = 0 关闭。
 * 单测可注入时钟与 store；进程内 Map，非集群。
 */

export const QUOTA_PLANES = ['ask', 'ingest', 'aux'] as const;
export type QuotaPlane = (typeof QUOTA_PLANES)[number];

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; remaining: 0; retryAfterSec: number };

export type RateLimitStore = Map<string, { count: number; windowStart: number }>;

export type RateLimitOptions = {
  /** 每窗口最大请求数；0 = 不限流 */
  limit: number;
  windowMs?: number;
  store?: RateLimitStore;
  now?: () => number;
};

/** ask 平面默认 store；与 ingest 分实例 */
export const askRateLimitStore: RateLimitStore = new Map();
/** ingest 平面默认 store；与 ask 分实例 */
export const ingestRateLimitStore: RateLimitStore = new Map();

/**
 * @param key 通常带平面前缀，如 `ask:userId:kbId`
 */
export function checkFixedWindowRateLimit(
  key: string,
  options: RateLimitOptions,
): RateLimitResult {
  const limit = options.limit;
  if (limit <= 0) {
    return { ok: true, remaining: Number.POSITIVE_INFINITY };
  }
  const windowMs = options.windowMs ?? 60_000;
  const store = options.store ?? askRateLimitStore;
  const now = (options.now ?? Date.now)();

  let slot = store.get(key);
  if (!slot || now - slot.windowStart >= windowMs) {
    slot = { count: 0, windowStart: now };
    store.set(key, slot);
  }

  if (slot.count >= limit) {
    const retryAfterSec = Math.max(1, Math.ceil((slot.windowStart + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }

  slot.count += 1;
  return { ok: true, remaining: Math.max(0, limit - slot.count) };
}

export function resetRateLimitStore(store?: RateLimitStore): void {
  if (store) {
    store.clear();
    return;
  }
  askRateLimitStore.clear();
  ingestRateLimitStore.clear();
}

export function askRateLimitKey(userId: string, kbId: string): string {
  return `ask:${userId}:${kbId}`;
}

/** ingest 键按 tenant+kb，与 ask 分前缀 */
export function ingestRateLimitKey(tenantId: string, kbId: string): string {
  return `ingest:${tenantId}:${kbId}`;
}
