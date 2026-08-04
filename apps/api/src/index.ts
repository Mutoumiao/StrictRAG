/**
 * apps/api — Hono + Node HTTP
 * Phase 0：env Zod · Pino · GET /health · GET /ready
 * 规格：prds/05-api · ADR-028
 */

import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';

const app = createApp();

serve(
  {
    fetch: app.fetch,
    port: env.API_PORT,
    hostname: '0.0.0.0',
  },
  (info) => {
    logger.info(
      {
        port: info.port,
        tauClaim: env.TAU_CLAIM,
        gatewayConfigured: Boolean(env.GATEWAY_BASE_URL),
      },
      `api listening on http://127.0.0.1:${info.port}`,
    );
  },
);

export { createApp };
