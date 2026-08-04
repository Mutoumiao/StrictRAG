import { describe, expect, it } from 'vitest';

import { formatLocalDateTime } from './time.js';

describe('formatLocalDateTime', () => {
  it('returns yyyy-MM-dd HH:mm:ss shape', () => {
    const value = formatLocalDateTime(new Date('2026-08-04T12:34:56'));
    expect(value).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
