/**
 * apps/api — Hono + Node HTTP
 * Phase 0：env Zod · Pino · GET /health · GET /ready
 * ARCH-P0：SIGINT/SIGTERM → closeDb + closeQueue
 * 规格：prds/05-api · ADR-028
 */

import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { closeDb } from './services/db.js';
import { closeQueue } from './services/queue.js';

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

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) {
    logger.warn({ signal }, 'shutdown already in progress; force exit');
    process.exit(1);
  }
  shuttingDown = true;
  logger.info({ signal }, 'api shutting down');
  try {
    await closeDb();
  } catch (err) {
    logger.error({ err }, 'closeDb failed');
  }
  try {
    await closeQueue();
  } catch (err) {
    logger.error({ err }, 'closeQueue failed');
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

export { createApp };
