import { describe, expect, it } from 'vitest';

import { ApiHttpError } from '@/lib/http';
import { mapBizError } from '@/lib/map-biz-error';

describe('mapBizError', () => {
  it('ApiHttpError 与 fallback', () => {
    expect(mapBizError(new ApiHttpError('FORBIDDEN', 'x'))).toBe('FORBIDDEN: x');
    expect(mapBizError(null, '兜底')).toBe('兜底');
  });
});
