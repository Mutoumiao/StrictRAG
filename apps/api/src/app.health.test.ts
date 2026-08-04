import { describe, expect, it } from 'vitest';

import { createApp } from './app.js';

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
