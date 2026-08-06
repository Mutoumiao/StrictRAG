import { createDb, type Db } from '@strict-rag/db';

import { env } from './env.js';

let cached: ReturnType<typeof createDb> | null = null;

/**
 * worker 长入库任务：不设 statement_timeout（0）。
 * 禁止复用 api 的 15s 默认。
 */
export function getDb(): Db {
  if (!cached) {
    cached = createDb({
      connectionString: env.DATABASE_URL,
      statementTimeoutMs: 0,
      lockTimeoutMs: 0,
    });
  }
  return cached.db;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
