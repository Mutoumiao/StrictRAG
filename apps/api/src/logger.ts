import pino from 'pino';

import { env } from './env.js';

/**
 * Pino 日志骨架。
 * 上下文预留：requestId / tenantId / userId / kbId / sessionId。
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'api',
    env: env.APP_ENV,
  },
  transport:
    env.APP_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});

export type LogContext = {
  requestId?: string;
  tenantId?: string;
  userId?: string;
  kbId?: string;
  sessionId?: string;
};

export function childLogger(ctx: LogContext) {
  return logger.child(ctx);
}
