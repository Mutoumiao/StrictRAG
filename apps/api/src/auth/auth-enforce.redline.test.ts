import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';

import { ok } from '../lib/response.js';
import { requestIdMiddleware, type ApiVariables } from '../middleware/request-id.js';
import {
  attachAuthMiddleware,
  isAuthEnforceEnabled,
  requirePermissionWhenEnforced,
} from './middleware.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('QUAL-1 AUTH_ENFORCE 401 红线', () => {
  function buildIngestProbe() {
    const app = new Hono<{ Variables: ApiVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.post(
      '/api/v1/knowledge-bases/:kbId/documents',
      requirePermissionWhenEnforced('doc.upload'),
      (c) => ok(c, { uploaded: true }, 201),
    );
    return app;
  }

  it('默认 AUTH_ENFORCE 关：无 Bearer 受保护 WhenEnforced 仍放行', async () => {
    // 不 stub；与仓库默认 false 一致
    expect(isAuthEnforceEnabled()).toBe(false);
    const app = buildIngestProbe();
    const res = await app.request('/api/v1/knowledge-bases/kb-1/documents', {
      method: 'POST',
    });
    expect(res.status).toBe(201);
  });

  it('AUTH_ENFORCE=true 无 Bearer → 401 + UNAUTHORIZED', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    expect(isAuthEnforceEnabled()).toBe(true);

    const app = buildIngestProbe();
    const res = await app.request('/api/v1/knowledge-bases/kb-1/documents', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      ok: boolean;
      error: { code: string; message: string };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('stub 还原后 enforce 恢复关', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    expect(isAuthEnforceEnabled()).toBe(true);
    vi.unstubAllEnvs();
    expect(isAuthEnforceEnabled()).toBe(false);
  });
});
