/**
 * 目标：超限 JSON body 必须 413 PAYLOAD_TOO_LARGE。
 * 需求：prds/05-api · ARCH-P0
 * 被测：createApp body-limit
 * 简介：超限 JSON body 必须 413 PAYLOAD_TOO_LARGE。
 */

import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';

describe('ARCH-P0 body limit', () => {
  it('JSON POST body over limit → 413 PAYLOAD_TOO_LARGE', async () => {
    const app = createApp();
    // 默认 1 MiB；构造略超限 body
    const big = 'x'.repeat(1_048_576 + 100);
    const res = await app.request('/api/v1/auth/dev-login', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(JSON.stringify({ pad: big }))),
      },
      body: JSON.stringify({ pad: big }),
    });
    expect(res.status).toBe(413);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
