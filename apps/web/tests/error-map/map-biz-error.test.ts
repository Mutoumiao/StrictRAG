/**
 * 目标：已知业务码必须保留 code 与 message。
 * 需求：P0 R3
 * 被测：mapBizError
 * 简介：纯文案映射。
 */

import { describe, expect, it } from 'vitest';

import { ApiHttpError } from '@/lib/http';
import { mapBizError } from '@/lib/map-biz-error';

describe('mapBizError', () => {
  it('R3: ApiHttpError 与 fallback 保留 code', () => {
    expect(mapBizError(new ApiHttpError('FORBIDDEN', 'x'))).toBe('FORBIDDEN: x');
    expect(mapBizError(null, '兜底')).toBe('兜底');
  });
});
