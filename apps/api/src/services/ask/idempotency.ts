/**
 * 问答请求幂等（PRD 05-api §2.7 契约铁律 6）。
 * 同 key：未 finalize 前可重试/重连；已 finalize 则复用同一 requestId 的终态 DTO，不得开第二条并行图。
 * 落点与 TTL 冻结：Redis `ask:idem:{key}`，10m（prds/03-data §2.1）。
 * HOW：api spec ask-pipeline §幂等。
 */

/** 冻结 TTL（10m） */
export const ASK_IDEM_TTL_SEC = 600;

/** 键前缀：`sr:` 仓库约定 + 冻结的 `ask:idem` 语义 */
export const ASK_IDEM_KEY_PREFIX = 'sr:ask:idem:';

/** 幂等键长度上限（PRD 未写；超长拒 400，不得静默降级成「无幂等」） */
export const ASK_IDEM_RAW_KEY_MAX = 200;

/**
 * 作用域键：含 tenant（存储边界「Redis key 含 tenant」）+ user + kb，
 * 使跨用户 / 跨 KB 在构造上不可命中。
 */
export function askIdemKey(input: {
  tenantId: string;
  userId: string;
  kbId: string;
  rawKey: string;
}): string {
  return `${ASK_IDEM_KEY_PREFIX}${input.tenantId}:${input.userId}:${input.kbId}:${input.rawKey}`;
}

/** header 归一：空白视为未带；超长由调用方拒。 */
export function normalizeIdempotencyKey(raw: string | undefined | null): string | null {
  const key = (raw ?? '').trim();
  return key.length > 0 ? key : null;
}

/** 后端最小面（不绑 ioredis 重载签名，便于单测）。 */
export type AskIdemStore = {
  /** SET key value EX ttl NX；true = 本次抢到 */
  setNxEx(key: string, value: string, ttlSec: number): Promise<boolean>;
  get(key: string): Promise<string | null>;
  /** DEL（失败释放用；幂等） */
  del(key: string): Promise<void>;
};

export type AskIdemClaim =
  | { status: 'claimed' }
  | { status: 'reuse'; requestId: string };

/**
 * 抢占幂等键。
 * `reuse.requestId` = 首次请求的 requestId（不是本轮 requestId）。
 */
export async function claimAskIdem(
  store: AskIdemStore,
  key: string,
  requestId: string,
  ttlSec: number = ASK_IDEM_TTL_SEC,
): Promise<AskIdemClaim> {
  const claimed = await store.setNxEx(key, requestId, ttlSec);
  if (claimed) return { status: 'claimed' };
  const existing = await store.get(key);
  if (!existing) {
    // TTL 刚好过期（SET NX 与 GET 之间）：重抢一次，避免误报在途
    const retry = await store.setNxEx(key, requestId, ttlSec);
    if (retry) return { status: 'claimed' };
    const after = await store.get(key);
    return after ? { status: 'reuse', requestId: after } : { status: 'claimed' };
  }
  return { status: 'reuse', requestId: existing };
}

/** 释放（仅跑图抛错、终态未落库时调用；不得用于「缩短 TTL」）。 */
export async function releaseAskIdem(store: AskIdemStore, key: string): Promise<void> {
  await store.del(key);
}

/** 单测 / 无 Redis 场景的内存实现（**不得**用于生产：多副本不共享）。 */
export function createMemoryAskIdemStore(): AskIdemStore {
  const rows = new Map<string, string>();
  return {
    async setNxEx(key, value) {
      if (rows.has(key)) return false;
      rows.set(key, value);
      return true;
    },
    async get(key) {
      return rows.get(key) ?? null;
    },
    async del(key) {
      rows.delete(key);
    },
  };
}

/** ioredis 最小形状（避免整包类型耦合） */
export type IoredisLike = {
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttl: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<unknown>;
};

export function createIoredisAskIdemStore(redis: IoredisLike): AskIdemStore {
  return {
    async setNxEx(key, value, ttlSec) {
      const res = await redis.set(key, value, 'EX', ttlSec, 'NX');
      return res === 'OK';
    },
    get: (key) => redis.get(key),
    async del(key) {
      await redis.del(key);
    },
  };
}
