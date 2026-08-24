/**
 * 目标：GET /ready 在 PG 或 Redis 不可用时必须 503 且 ready 为 false。
 * 需求：剧本 H3 · prds/10-delivery/03-acceptance-scenarios.md
 * 被测：GET /ready · runReadyChecks（postgres/redis 硬依赖）
 * 简介：mock createDb 抛错或 ioredis ping 失败 → 503；不停本机 PG。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ctl = vi.hoisted(() => ({ postgresUp: true, redisUp: true }));

vi.mock('@strict-rag/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@strict-rag/db')>();
  return {
    ...actual,
    createDb: () => {
      if (!ctl.postgresUp) throw new Error('postgres down');
      const client = async () => [{ ok: 1 }];
      return { client, db: {}, close: async () => undefined };
    },
  };
});

vi.mock('ioredis', () => {
  class RedisMock {
    constructor(_url?: string, _opts?: unknown) {}
    async connect() {
      return undefined;
    }
    async ping() {
      if (!ctl.redisUp) throw new Error('redis ping failed');
      return 'PONG';
    }
    disconnect() {
      return undefined;
    }
  }
  return { Redis: RedisMock, default: RedisMock };
});

import { createApp } from '../../src/app.js';
import { env } from '../../src/env.js';

type ReadyBody = {
  service: string;
  ready: boolean;
  checks: Record<string, 'up' | 'down' | 'skipped'>;
};

const original = {
  ELASTICSEARCH_URL: env.ELASTICSEARCH_URL,
  MONGODB_URL: env.MONGODB_URL,
  S3_ENDPOINT: env.S3_ENDPOINT,
};

beforeEach(() => {
  ctl.postgresUp = true;
  ctl.redisUp = true;
  env.ELASTICSEARCH_URL = '';
  env.MONGODB_URL = '';
  env.S3_ENDPOINT = '';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('network disabled in ready-hard-deps');
    }),
  );
});

afterEach(() => {
  env.ELASTICSEARCH_URL = original.ELASTICSEARCH_URL;
  env.MONGODB_URL = original.MONGODB_URL;
  env.S3_ENDPOINT = original.S3_ENDPOINT;
  vi.unstubAllGlobals();
});

describe('GET /ready hard deps', () => {
  it('postgres down → 503 and not ready', async () => {
    ctl.postgresUp = false;
    const res = await createApp().request('/ready');
    expect(res.status).toBe(503);
    const body = (await res.json()) as ReadyBody;
    expect(body.ready).toBe(false);
    expect(body.checks.postgres).toBe('down');
  });

  it('redis ping fail → 503 and not ready', async () => {
    ctl.redisUp = false;
    const res = await createApp().request('/ready');
    expect(res.status).toBe(503);
    const body = (await res.json()) as ReadyBody;
    expect(body.ready).toBe(false);
    expect(body.checks.redis).toBe('down');
  });
});
