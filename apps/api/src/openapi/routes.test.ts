import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { createApp } from '../app.js';
import { env } from '../env.js';
import { requestIdMiddleware, type ApiVariables } from '../middleware/request-id.js';
import { buildOpenApiDocument } from './document.js';
import { createOpenApiRoutes, isOpenApiDocsEnabled } from './routes.js';

describe('OpenAPI HTTP routes (ARCH-P2-1)', () => {
  it('serves openapi.json when docs enabled (test default)', async () => {
    // vitest 通常 APP_ENV=test → 默认开启
    expect(isOpenApiDocsEnabled(env.APP_ENV, env.OPENAPI_DOCS_ENABLED)).toBe(true);

    const app = createApp();
    const res = await app.request('/api/v1/openapi.json');
    expect(res.status).toBe(200);
    const body = (await res.json()) as ReturnType<typeof buildOpenApiDocument>;
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toMatch(/StrictRAG/i);
    expect(body.components.schemas.HealthResponse).toBeDefined();
    expect(body.components.schemas.AskRequest).toBeDefined();
    expect(body.paths['/health']).toBeDefined();
    expect(body.paths['/api/v1/knowledge-bases/{kbId}/ask']).toBeDefined();
  });

  it('serves Scalar HTML docs referencing openapi.json', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/docs');
    expect(res.status).toBe(200);
    const ct = res.headers.get('content-type') ?? '';
    expect(ct).toMatch(/text\/html/i);
    const html = await res.text();
    expect(html).toContain('/api/v1/openapi.json');
    expect(html.toLowerCase()).toMatch(/scalar/);
  });

  it('openapi document body matches buildOpenApiDocument()', async () => {
    const app = createApp();
    const res = await app.request('/api/v1/openapi.json');
    const body = await res.json();
    const expected = buildOpenApiDocument();
    expect(body).toEqual(expected);
  });

  it('returns 404 ApiFailure envelope when docs disabled', async () => {
    const mini = new Hono<{ Variables: ApiVariables }>();
    mini.use('*', requestIdMiddleware);
    mini.route('/', createOpenApiRoutes({ enabled: () => false }));

    for (const path of ['/api/v1/openapi.json', '/api/v1/docs'] as const) {
      const res = await mini.request(path);
      expect(res.status).toBe(404);
      const body = (await res.json()) as {
        ok: boolean;
        error?: { code?: string };
      };
      expect(body.ok).toBe(false);
      expect(body.error?.code).toBe('NOT_FOUND');
    }
  });
});
