/**
 * 目标：upload-url 必须在建档前拒绝未知 MIME。
 * 需求：ADR-039 · 功能表 §5.2 · prds/05-api complete
 * 被测：checkUploadMedia · POST upload-url
 * 简介：415 UNSUPPORTED_MEDIA_TYPE；不建档。无真集群。
 */

import { describe, expect, it } from 'vitest';

import { createApp } from '../../src/app.js';
import { checkUploadMedia } from '../../src/gates/upload-media.js';

describe('checkUploadMedia', () => {
  it('合法 text/plain 通过；octet-stream 拒绝', () => {
    expect(checkUploadMedia({ contentType: 'text/plain', fileName: 'a.txt' })).toEqual({
      ok: true,
    });
    expect(checkUploadMedia({ contentType: 'application/octet-stream', fileName: 'a.bin' })).toEqual(
      { ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' },
    );
  });
});

describe('POST upload-url media gate (no DB)', () => {
  it('octet-stream → 415 且不建档', async () => {
    const app = createApp();
    const res = await app.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-0000000000aa/documents/upload-url',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'payload.bin', contentType: 'application/octet-stream' }),
      },
    );
    expect(res.status).toBe(415);
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });

  it('PUT octet-stream → 415', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/internal/objects?key=kb/x/obj', {
      method: 'PUT',
      headers: { 'content-type': 'application/octet-stream' },
      body: 'abc',
    });
    expect(res.status).toBe(415);
    const body = (await res.json()) as { ok: boolean; error?: { code: string } };
    expect(body.error?.code).toBe('UNSUPPORTED_MEDIA_TYPE');
  });
});
