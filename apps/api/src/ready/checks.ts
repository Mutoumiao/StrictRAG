import { createDb } from '@strict-rag/db';
import { Redis } from 'ioredis';

import { env } from '../env.js';
import { logger } from '../logger.js';

export type CheckStatus = 'up' | 'down' | 'skipped';

export type ReadyChecks = Record<string, CheckStatus>;

async function checkPostgres(): Promise<CheckStatus> {
  try {
    const { client, close } = createDb({ connectionString: env.DATABASE_URL, max: 1 });
    try {
      await client`select 1`;
      return 'up';
    } finally {
      await close();
    }
  } catch (err) {
    logger.warn({ err }, 'ready: postgres down');
    return 'down';
  }
}

async function checkRedis(): Promise<CheckStatus> {
  const redis = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: true,
  });
  try {
    await redis.connect();
    const pong = await redis.ping();
    return pong === 'PONG' ? 'up' : 'down';
  } catch (err) {
    logger.warn({ err }, 'ready: redis down');
    return 'down';
  } finally {
    redis.disconnect();
  }
}

async function checkElasticsearch(): Promise<CheckStatus> {
  if (!env.ELASTICSEARCH_URL) return 'skipped';
  try {
    const res = await fetch(`${env.ELASTICSEARCH_URL.replace(/\/$/, '')}/_cluster/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? 'up' : 'down';
  } catch (err) {
    logger.warn({ err }, 'ready: elasticsearch down');
    return 'down';
  }
}

/**
 * Gateway 探针：未配置 base URL 则 skipped；配置后尝试 GET /v1/models 或根路径。
 */
export async function checkGateway(): Promise<CheckStatus> {
  if (!env.GATEWAY_BASE_URL) return 'skipped';
  try {
    const base = env.GATEWAY_BASE_URL.replace(/\/$/, '');
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (env.GATEWAY_API_KEY) {
      headers.Authorization = `Bearer ${env.GATEWAY_API_KEY}`;
    }
    const res = await fetch(`${base}/v1/models`, {
      headers,
      signal: AbortSignal.timeout(5000),
    });
    // 401/403 表示端点可达但鉴权失败，仍记为 up（配置位有效）
    if (res.ok || res.status === 401 || res.status === 403) return 'up';
    return 'down';
  } catch (err) {
    logger.warn({ err }, 'ready: gateway down');
    return 'down';
  }
}

export async function runReadyChecks(): Promise<{ ready: boolean; checks: ReadyChecks }> {
  const [postgres, redis, elasticsearch, gateway] = await Promise.all([
    checkPostgres(),
    checkRedis(),
    checkElasticsearch(),
    checkGateway(),
  ]);

  const checks: ReadyChecks = { postgres, redis, elasticsearch, gateway };

  // 硬依赖：PG + Redis 必须 up；skipped 不计入失败；down 则 not ready
  const hardDown = postgres === 'down' || redis === 'down';
  const ready = !hardDown;

  return { ready, checks };
}
