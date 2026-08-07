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
