import { describe, expect, it } from 'vitest';

import { ApiHttpError } from '@/lib/http';
import { mapBizError } from '@/lib/map-biz-error';

describe('mapBizError', () => {
  it('R6: ApiHttpError 与 fallback 保留 code', () => {
    expect(mapBizError(new ApiHttpError('UNAUTHORIZED', 'x', false))).toBe('UNAUTHORIZED: x');
    expect(mapBizError(undefined, '加载失败')).toBe('加载失败');
  });
});
