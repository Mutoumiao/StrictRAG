import { describe, expect, it } from 'vitest';

import { createApp } from '../../app.js';

describe('document routes validation (no DB hit on bad body)', () => {
  it('POST /knowledge-bases rejects empty body', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/knowledge-bases', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST upload-url rejects invalid body before storage', async () => {
    const app = createApp();
    const res = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-000000000099/documents/upload-url',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('PATCH lifecycle rejects invalid lifecycle enum', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/documents/01900000-0000-7000-8000-000000000099/lifecycle', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lifecycle: 'not-a-lifecycle' }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
