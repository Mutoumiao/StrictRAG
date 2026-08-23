/**
 * 目标：未知路径与未处理异常必须走统一错误信封，且不得泄漏 stack。
 * 需求：prds/05-api · ARCH-P0
 * 被测：createApp onError / isAskTimeoutExcept / isBodyLimitExcept
 * 简介：未知路径与未处理异常走统一信封，且不得泄漏 stack。
 */

import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { isBodyLimitExcept } from '../../src/middleware/body-limit.js';
import { isAskTimeoutExcept } from '../../src/middleware/timeout.js';

describe('ARCH-P0 error envelope', () => {
  it('GET unknown path → 404 NOT_FOUND + requestId', async () => {
    const app = createApp();
    const res = await app.request('/no-such-path-xyz', {
      headers: { 'x-request-id': 'test-req-404' },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string; message: string };
      meta: { requestId: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.meta.requestId).toBe('test-req-404');
    expect(res.headers.get('x-request-id')).toBe('test-req-404');
  });

  it('unhandled throw → 500 INTERNAL · no stack field', async () => {
    const app = createApp();
    app.get('/__test/throw', () => {
      throw new Error('boom');
    });
    const res = await app.request('/__test/throw');
    expect(res.status).toBe(500);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string; message?: string; stack?: string };
      meta: { requestId: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('INTERNAL');
    expect(body.error.stack).toBeUndefined();
    expect(body.meta.requestId).toBeTruthy();
    // 对外中性消息，不含 boom 细节亦可；至少无 stack
    expect(JSON.stringify(body)).not.toContain('stack');
  });

  it('throw PG-like 23505 → onError maps CONFLICT / 409', async () => {
    const app = createApp();
    app.get('/__test/pg-conflict', () => {
      const err = new Error('duplicate key') as Error & { name: string; code: string };
      err.name = 'PostgresError';
      err.code = '23505';
      throw err;
    });
    const res = await app.request('/__test/pg-conflict');
    expect(res.status).toBe(409);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('CONFLICT');
  });

  it('health still ok', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('ok');
  });
});

describe('ARCH-P0 path helpers', () => {
  it('ask path skips timeout', () => {
    expect(
      isAskTimeoutExcept('POST', '/api/v1/knowledge-bases/kb1/ask'),
    ).toBe(true);
    expect(isAskTimeoutExcept('GET', '/api/v1/knowledge-bases/kb1/ask')).toBe(false);
    expect(isAskTimeoutExcept('POST', '/api/v1/auth/dev-login')).toBe(false);
  });

  it('upload/complete paths except body limit', () => {
    expect(isBodyLimitExcept('PUT', '/api/v1/internal/objects')).toBe(true);
    expect(
      isBodyLimitExcept(
        'POST',
        '/api/v1/knowledge-bases/kb1/documents/doc1/complete',
      ),
    ).toBe(true);
    expect(isBodyLimitExcept('POST', '/api/v1/auth/dev-login')).toBe(false);
  });
});
