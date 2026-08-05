/**
 * ask 试点限流：固定窗口（每分钟）。
 * ASK_RATE_LIMIT_RPM=0 关闭。单测可注入时钟与 store。
 */

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

const defaultStore: RateLimitStore = new Map();

/**
 * @param key 通常 `userId:kbId`
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
  const store = options.store ?? defaultStore;
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

export function resetRateLimitStore(store: RateLimitStore = defaultStore): void {
  store.clear();
}

export function askRateLimitKey(userId: string, kbId: string): string {
  return `ask:${userId}:${kbId}`;
}
