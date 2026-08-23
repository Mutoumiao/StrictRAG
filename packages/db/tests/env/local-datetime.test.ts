/**
 * 目标：写库时间必须是本地 yyyy-MM-dd HH:mm:ss 格式串，失败则 ORM 时间契约不成立。
 * 需求：prds/02-engineering/02-orm-drizzle.md
 * 被测：formatLocalDateTime
 * 简介：断言输出形状为本地日期时间串。
 */

import { describe, expect, it } from 'vitest';

import { formatLocalDateTime } from '../../src/time.js';

describe('formatLocalDateTime', () => {
  it('returns yyyy-MM-dd HH:mm:ss shape', () => {
    const value = formatLocalDateTime(new Date('2026-08-04T12:34:56'));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
