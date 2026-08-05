import {
  HealthResponseSchema,
  ReadyResponseSchema,
  type HealthResponse,
  type ReadyResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { env, toHealthEnv } from './env.js';
import { childLogger } from './logger.js';
import { attachAuthMiddleware } from './auth/middleware.js';
import { requestIdMiddleware, type ApiVariables } from './middleware/request-id.js';
import { runReadyChecks } from './ready/checks.js';
import { askRoutes } from './routes/ask.js';
import { authRoutes } from './routes/auth.js';
import { documentRoutes } from './routes/documents.js';
import { memberRoutes } from './routes/members.js';
import { sessionRoutes } from './routes/sessions.js';

export function createApp() {
  const app = new Hono<{ Variables: ApiVariables }>();

  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);

  app.get('/health', (c) => {
    const body: HealthResponse = {
      service: 'api',
      env: toHealthEnv(env.APP_ENV),
      status: 'ok',
    };
    const parsed = HealthResponseSchema.parse(body);
    childLogger({ requestId: c.get('requestId') }).debug('health ok');
    return c.json(parsed, 200);
  });

  app.get('/ready', async (c) => {
    const { ready, checks } = await runReadyChecks();
    const body: ReadyResponse = {
      service: 'api',
      ready,
      checks,
    };
    const parsed = ReadyResponseSchema.parse(body);
    const log = childLogger({ requestId: c.get('requestId') });
    if (ready) {
      log.info({ checks }, 'ready ok');
    } else {
      log.warn({ checks }, 'ready not ready');
    }
    return c.json(parsed, ready ? 200 : 503);
  });

  app.route('/api/v1/auth', authRoutes);
  app.route('/api/v1', documentRoutes);
  app.route('/api/v1', memberRoutes);
  app.route('/api/v1', sessionRoutes);
  app.route('/api/v1', askRoutes);

  return app;
}

export type App = ReturnType<typeof createApp>;