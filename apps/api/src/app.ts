import {
  BizCode,
  HealthResponseSchema,
  ReadyResponseSchema,
  type HealthResponse,
  type ReadyResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';

import { env, toHealthEnv } from './env.js';
import { fail } from './lib/response.js';
import { childLogger } from './logger.js';
import { attachAuthMiddleware } from './auth/middleware.js';
import { adminWriteAuditMiddleware } from './middleware/admin-write-audit.js';
import { jsonBodyLimitMiddleware } from './middleware/body-limit.js';
import { onErrorHandler } from './middleware/on-error.js';
import { requestIdMiddleware, type ApiVariables } from './middleware/request-id.js';
import { requestTimeoutMiddleware } from './middleware/timeout.js';
import { metricsSnapshot } from './obs/index.js';
import { runReadyChecks } from './ready/checks.js';
import { askRoutes } from './routes/ask.js';
import { authRoutes } from './routes/auth.js';
import { chunkRoutes } from './routes/chunks.js';
import { documentRoutes } from './routes/documents.js';
import { feedbackRoutes } from './routes/feedback.js';
import { kbSettingsRoutes } from './routes/kb-settings.js';
import { memberRoutes } from './routes/members.js';
import { modelGatewayRoutes } from './routes/model-gateway.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { departmentsRoutes } from './routes/departments.js';
import { platformUsersRolesRoutes } from './routes/platform-users-roles.js';
import { sessionRoutes } from './routes/sessions.js';
import { createOpenApiRoutes } from './openapi/routes.js';

/** requestId → secureHeaders → timeout → bodyLimit → auth → adminWriteAudit → routes → notFound/onError */
export function createApp() {
  const app = new Hono<{ Variables: ApiVariables }>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());
  app.use('*', requestTimeoutMiddleware);
  app.use('*', jsonBodyLimitMiddleware);
  app.use('*', attachAuthMiddleware);
  app.use('*', adminWriteAuditMiddleware);

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

  /** 指标骨架快照（P2 无鉴权；生产可前置网关保护） */
  app.get('/metrics', (c) => c.json({ service: 'api', metrics: metricsSnapshot() }, 200));

  /** ARCH-P2-1：dev OpenAPI + Scalar（开关见 OPENAPI_DOCS_ENABLED） */
  app.route('/', createOpenApiRoutes());

  app.route('/api/v1/auth', authRoutes);
  app.route('/api/v1', documentRoutes);
  app.route('/api/v1', chunkRoutes);
  app.route('/api/v1', memberRoutes);
  app.route('/api/v1', kbSettingsRoutes);
  app.route('/api/v1', modelGatewayRoutes);
  app.route('/api/v1', platformUsersRolesRoutes);
  app.route('/api/v1', departmentsRoutes);
  app.route('/api/v1', dashboardRoutes);
  app.route('/api/v1', sessionRoutes);
  app.route('/api/v1', feedbackRoutes);
  app.route('/api/v1', askRoutes);

  app.notFound((c) => fail(c, BizCode.NOT_FOUND, '资源不存在', 404));
  app.onError(onErrorHandler);

  return app;
}

export type App = ReturnType<typeof createApp>;
