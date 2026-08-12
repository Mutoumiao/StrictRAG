/**
 * 同 doc 入库分布式锁（最小 · INGEST-LOCK）。
 * Redis SET key token EX ttl NX；释放用 token 校验（防误删他者锁）。
 * HOW：ingest-idempotency §5 · 非 Redlock / 非多 master。
 */

import { uuidv7 } from 'uuidv7';

/** 单 stage 默认租约（秒）；进程挂死后自动过期 */
export const DEFAULT_DOC_LOCK_TTL_SEC = 180;

const KEY_PREFIX = 'sr:ingest:doc-lock:';

/**
 * 锁后端最小面（不绑 ioredis 重载签名，便于单测与类型）。
 * 生产用 {@link createIoredisDocLock} 适配。
 */
export type DocLockStore = {
  /** SET NX EX；true = 获得锁 */
  setNxEx(key: string, value: string, ttlSec: number): Promise<boolean>;
  /** 仅当 value==token 时 DEL；true = 删掉了 */
  releaseIfOwner(key: string, token: string): Promise<boolean>;
};

/** 仅当 value==token 才 DEL（经典安全释放） */
export const RELEASE_LOCK_LUA = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`.trim();

/** ioredis 最小形状（避免整包类型耦合） */
export type IoredisLike = {
  set(
    key: string,
    value: string,
    expiryMode: 'EX',
    ttl: number,
    setMode: 'NX',
  ): Promise<'OK' | null>;
  eval(script: string, numKeys: number, key: string, token: string): Promise<unknown>;
};

export function createIoredisDocLock(redis: IoredisLike): DocLockStore {
  return {
    async setNxEx(key, value, ttlSec) {
      const res = await redis.set(key, value, 'EX', ttlSec, 'NX');
      return res === 'OK';
    },
    async releaseIfOwner(key, token) {
      const n = await redis.eval(RELEASE_LOCK_LUA, 1, key, token);
      return n === 1 || n === '1';
    },
  };
}

export function docLockKey(docId: string): string {
  return `${KEY_PREFIX}${docId}`;
}

export function mintDocLockToken(): string {
  return uuidv7();
}

/**
 * 尝试获取 doc 锁。
 * @returns true 表示本 token 已持有
 */
export async function tryAcquireDocLock(
  store: DocLockStore,
  docId: string,
  token: string,
  ttlSec: number = DEFAULT_DOC_LOCK_TTL_SEC,
): Promise<boolean> {
  return store.setNxEx(docLockKey(docId), token, ttlSec);
}

/**
 * 释放 doc 锁（仅 token 匹配时删除）。
 * @returns true 表示删掉了自己的锁
 */
export async function releaseDocLock(
  store: DocLockStore,
  docId: string,
  token: string,
): Promise<boolean> {
  return store.releaseIfOwner(docLockKey(docId), token);
}

/**
 * 持锁执行；抢锁失败抛可重试错误（DOC_LOCK_BUSY）。
 * finally 始终尝试释放本 token。
 */
export async function withDocLock<T>(
  store: DocLockStore,
  docId: string,
  fn: () => Promise<T>,
  options?: { ttlSec?: number; token?: string },
): Promise<T> {
  const token = options?.token ?? mintDocLockToken();
  const ttlSec = options?.ttlSec ?? DEFAULT_DOC_LOCK_TTL_SEC;
  const acquired = await tryAcquireDocLock(store, docId, token, ttlSec);
  if (!acquired) {
    throw new Error('ingest retryable failure: DOC_LOCK_BUSY');
  }
  try {
    return await fn();
  } finally {
    try {
      await releaseDocLock(store, docId, token);
    } catch {
      // TTL 仍会过期；释放失败不得掩盖 fn 结果/异常
    }
  }
}
