import { describe, expect, it } from 'vitest';

import { parseDocTypesInput } from './services';

describe('parseDocTypesInput', () => {
  it('splits comma and whitespace', () => {
    expect(parseDocTypesInput('hr, legal  finance')).toEqual(['hr', 'legal', 'finance']);
  });

  it('empty is clear restriction', () => {
    expect(parseDocTypesInput('  ')).toEqual([]);
  });
});
