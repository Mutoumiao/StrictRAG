import { createDb, type Db } from '@strict-rag/db';

import { env } from '../env.js';

let cached: ReturnType<typeof createDb> | null = null;

export function getDb(): Db {
  if (!cached) {
    cached = createDb({ connectionString: env.DATABASE_URL });
  }
  return cached.db;
}

export async function closeDb(): Promise<void> {
  if (cached) {
    await cached.close();
    cached = null;
  }
}
