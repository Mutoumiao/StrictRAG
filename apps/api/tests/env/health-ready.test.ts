/**
 * 目标：health 探针必须返回 ok。
 * 需求：P0
 * 被测：GET /health
 * 简介：health/ready。
 */

import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

describe('GET /health', () => {
  it('returns service envelope without DB', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      service: string;
      env: string;
      status: string;
    };
    expect(body.service).toBe('api');
    expect(body.status).toBe('ok');
    expect(['development', 'test', 'staging', 'production']).toContain(body.env);
  });
});
