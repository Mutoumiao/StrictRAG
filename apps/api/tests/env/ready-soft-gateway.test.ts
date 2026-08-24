/**
 * 目标：Gateway 不可用时 GET /ready 仍 200，不得因软依赖否决。
 * 需求：剧本 H4 · prds/10-delivery/03-acceptance-scenarios.md · ADR-028
 * 被测：GET /ready · checkGateway
 * 简介：PG/Redis mock 为 up、Gateway fetch 失败时 checks.gateway 为 down 且 ready 为 true。
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
  GATEWAY_BASE_URL: env.GATEWAY_BASE_URL,
  ELASTICSEARCH_URL: env.ELASTICSEARCH_URL,
  MONGODB_URL: env.MONGODB_URL,
  S3_ENDPOINT: env.S3_ENDPOINT,
};

beforeEach(() => {
  ctl.postgresUp = true;
  ctl.redisUp = true;
  env.GATEWAY_BASE_URL = 'http://gateway.test.invalid';
  env.ELASTICSEARCH_URL = '';
  env.MONGODB_URL = '';
  env.S3_ENDPOINT = '';
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('gateway down');
    }),
  );
});

afterEach(() => {
  env.GATEWAY_BASE_URL = original.GATEWAY_BASE_URL;
  env.ELASTICSEARCH_URL = original.ELASTICSEARCH_URL;
  env.MONGODB_URL = original.MONGODB_URL;
  env.S3_ENDPOINT = original.S3_ENDPOINT;
  vi.unstubAllGlobals();
});

describe('GET /ready soft gateway', () => {
  it('gateway down does not veto ready', async () => {
    const res = await createApp().request('/ready');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReadyBody;
    expect(body.ready).toBe(true);
    expect(body.checks.postgres).toBe('up');
    expect(body.checks.redis).toBe('up');
    expect(body.checks.gateway).toBe('down');
  });
});
