'use client';

import { ApiHttpError } from '@/lib/http';

/** API / 未知错误 → 用户可见文案（services 共用，无 path）。 */
export function mapBizError(err: unknown, fallback = '请求失败'): string {
  if (err instanceof ApiHttpError) return `${err.code}: ${err.message}`;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
