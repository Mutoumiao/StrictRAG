import { format } from 'date-fns';

/** 写库时间：本地格式串，禁止 toISOString() 写 DB（ORM PRD）。 */
export function formatLocalDateTime(date: Date = new Date()): string {
  return format(date, 'yyyy-MM-dd HH:mm:ss');
}
