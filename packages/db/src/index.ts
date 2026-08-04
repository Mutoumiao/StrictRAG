/**
 * @strict-rag/db
 * Drizzle schema + client（api / worker 共用）。
 * 规格：prds/03-data · prds/02-engineering/02-orm-drizzle.md
 */

export { createDb, type CreateDbOptions, type Db } from './client.js';
export { formatLocalDateTime } from './time.js';
export * from './schema/index.js';
export {
  filterDefaultRetrievable,
  isDefaultRetrievable,
  type RetrievalDocLike,
} from './query/retrieval-gate.js';