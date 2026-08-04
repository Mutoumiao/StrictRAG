import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type CreateDbOptions = {
  connectionString: string;
  max?: number;
};

/**
 * 创建 Drizzle 客户端（api / worker 共用）。
 * 调用方负责传入已校验的 DATABASE_URL。
 */
export function createDb(options: CreateDbOptions) {
  const client = postgres(options.connectionString, {
    max: options.max ?? 10,
    idle_timeout: 45,
    connect_timeout: 30,
    max_lifetime: 60 * 30,
    transform: {
      undefined: null,
    },
  });

  const db = drizzle(client, { schema });

  return {
    db,
    client,
    async close() {
      await client.end({ timeout: 5 });
    },
  };
}

export type Db = ReturnType<typeof createDb>['db'];
