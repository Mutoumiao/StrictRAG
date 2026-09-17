/**
 * api 侧共享 Redis 连接（队列 + 幂等键等轻量 KV）。
 * BullMQ Queue 与 KV 命令共用一条连接；阻塞型命令只在 worker 侧。
 */

import { Redis } from 'ioredis';

import { env } from '../env.js';

let redis: Redis | null = null;

export function getApiRedis(): Redis {
  if (!redis) {
    redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
  }
  return redis;
}

/** 优雅关闭（幂等） */
export function closeApiRedis(): void {
  if (redis) {
    redis.disconnect();
    redis = null;
  }
}
