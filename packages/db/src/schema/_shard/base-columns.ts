import { timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';

import { formatLocalDateTime } from '../../time.js';

/**
 * 共用列：uuid v7 + 本地时区时间字符串。
 * 对齐 clhoria-template / ORM PRD。
 */
export const baseColumns = {
  id: uuid('id')
    .primaryKey()
    .notNull()
    .$defaultFn(() => uuidv7()),

  createdAt: timestamp('created_at', { mode: 'string', precision: 0 }).$defaultFn(() =>
    formatLocalDateTime(),
  ),

  createdBy: varchar('created_by', { length: 64 }),

  updatedAt: timestamp('updated_at', { mode: 'string', precision: 0 })
    .$defaultFn(() => formatLocalDateTime())
    .$onUpdate(() => formatLocalDateTime()),

  updatedBy: varchar('updated_by', { length: 64 }),
};
