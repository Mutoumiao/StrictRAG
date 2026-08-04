import pino from 'pino';

import { env } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: 'worker',
    env: env.APP_ENV,
  },
  transport:
    env.APP_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
});
