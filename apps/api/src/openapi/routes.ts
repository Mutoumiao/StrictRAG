import { Hono } from 'hono';

import { env } from '../env.js';
import { fail } from '../lib/response.js';
import type { ApiVariables } from '../middleware/request-id.js';
import { BizCode } from '@strict-rag/contracts';

import { buildOpenApiDocument } from './document.js';

/** 与 env 闸一致；单测可直接调用 */
export function isOpenApiDocsEnabled(
  appEnv: string = env.APP_ENV,
  flag: boolean | undefined = env.OPENAPI_DOCS_ENABLED,
): boolean {
  if (flag !== undefined) return flag;
  return appEnv === 'development' || appEnv === 'test';
}

const OPENAPI_JSON_PATH = '/api/v1/openapi.json';

function scalarHtml(): string {
  // 零新依赖：Scalar CDN；spec 同源 openapi.json
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>StrictRAG API · OpenAPI</title>
</head>
<body>
  <div id="app"></div>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  <script>
    Scalar.createApiReference('#app', {
      url: ${JSON.stringify(OPENAPI_JSON_PATH)},
    });
  </script>
</body>
</html>`;
}

export type OpenApiRouteOptions = {
  /** 可注入开关（单测）；默认读 env */
  enabled?: () => boolean;
};

/**
 * OpenAPI JSON + Scalar docs。
 * 挂在 `/` 根下（路径自带 `/api/v1/...`），与 app 其它 route 并列。
 */
export function createOpenApiRoutes(opts?: OpenApiRouteOptions) {
  const app = new Hono<{ Variables: ApiVariables }>();
  const enabled = opts?.enabled ?? (() => isOpenApiDocsEnabled());

  app.get('/api/v1/openapi.json', (c) => {
    if (!enabled()) {
      return fail(c, BizCode.NOT_FOUND, 'OpenAPI 文档未开启', 404);
    }
    return c.json(buildOpenApiDocument(), 200);
  });

  app.get('/api/v1/docs', (c) => {
    if (!enabled()) {
      return fail(c, BizCode.NOT_FOUND, 'OpenAPI 文档未开启', 404);
    }
    return c.html(scalarHtml());
  });

  return app;
}
