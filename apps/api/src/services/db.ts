import { createDb, type Db } from '@strict-rag/db';

import { env } from '../env.js';

/** api 短查询默认；worker 不得复用此超时 */
const API_STATEMENT_TIMEOUT_MS = 15_000;
const API_LOCK_TIMEOUT_MS = 10_000;

let cached: ReturnType<typeof createDb> | null = null;

export function getDb(): Db {
  if (!cached) {
    cached = createDb({
      connectionString: env.DATABASE_URL,
      statementTimeoutMs: API_STATEMENT_TIMEOUT_MS,
      lockTimeoutMs: API_LOCK_TIMEOUT_MS,
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
