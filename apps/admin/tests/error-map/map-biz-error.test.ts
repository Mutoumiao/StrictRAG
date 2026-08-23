/**
 * 目标：已知业务码映射后文案必须含 code，失败则运营页看不到可核对错误码。
 * 需求：P0 R6
 * 被测：mapBizError
 * 简介：不透出 shouldRefresh。
 */

import { describe, expect, it } from 'vitest';

import { ApiHttpError } from '@/lib/http';
import { mapBizError } from '@/lib/map-biz-error';

describe('mapBizError', () => {
  it('R6: ApiHttpError 与 fallback 保留 code', () => {
    expect(mapBizError(new ApiHttpError('UNAUTHORIZED', 'x', false))).toBe('UNAUTHORIZED: x');
    expect(mapBizError(undefined, '加载失败')).toBe('加载失败');
  });
});
