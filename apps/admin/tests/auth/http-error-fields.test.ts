/**
 * 目标：ApiHttpError 必须保留 code 与 shouldRefresh，失败则刷新闸丢失字段。
 * 需求：P0 R5
 * 被测：ApiHttpError
 * 简介：三参构造直断言字段。
 */

import { describe, expect, it } from 'vitest';

import { ApiHttpError } from '@/lib/http';

describe('ApiHttpError fields', () => {
  it('R5: code 与 shouldRefresh 字段保留', () => {
    const err = new ApiHttpError('UNAUTHORIZED', 'please refresh', true);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('please refresh');
    expect(err.shouldRefresh).toBe(true);

    const noRefresh = new ApiHttpError('FORBIDDEN', 'no', false);
    expect(noRefresh.shouldRefresh).toBe(false);
    expect(noRefresh.code).toBe('FORBIDDEN');
  });
});
