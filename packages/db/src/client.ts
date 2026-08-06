import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema/index.js';

export type CreateDbOptions = {
  connectionString: string;
  max?: number;
  /**
   * session statement_timeout（ms）。
   * 0 / 不传 = 不设置（worker 长任务用）。
   * api 建议 15_000。
   */
  statementTimeoutMs?: number;
  /**
   * session lock_timeout（ms）。
   * 0 / 不传 = 不设置。
   * api 建议 10_000。
   */
  lockTimeoutMs?: number;
};

/**
 * 创建 Drizzle 客户端（api / worker 共用）。
 * 调用方负责传入已校验的 DATABASE_URL。
 * **分端超时**：api 短超时；worker 禁止无脑 15s。
 */
export function createDb(options: CreateDbOptions) {
  const connection: Partial<postgres.ConnectionParameters> = {};
  if (options.statementTimeoutMs != null && options.statementTimeoutMs > 0) {
    connection.statement_timeout = options.statementTimeoutMs;
  }
  if (options.lockTimeoutMs != null && options.lockTimeoutMs > 0) {
    connection.lock_timeout = options.lockTimeoutMs;
  }

  const client = postgres(options.connectionString, {
    max: options.max ?? 10,
    idle_timeout: 45,
    connect_timeout: 30,
    max_lifetime: 60 * 30,
    transform: {
      undefined: null,
    },
    ...(Object.keys(connection).length > 0 ? { connection } : {}),
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
