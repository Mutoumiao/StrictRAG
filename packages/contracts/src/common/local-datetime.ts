import { z } from 'zod';

/** 与 formatLocalDateTime 对齐；乱字符串不得写库。 */
export const LocalDateTimeStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/, 'expected yyyy-MM-dd HH:mm:ss');
