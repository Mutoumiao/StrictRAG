import { describe, expect, it } from 'vitest';

import { canPublish, canRevertDraft } from './lifecycle.services';

describe('lifecycle gates', () => {
  it('publish only ready and not already active', () => {
    expect(canPublish('ready', 'draft')).toBe(true);
    expect(canPublish('ready', 'active')).toBe(false);
    expect(canPublish('parsing', 'draft')).toBe(false);
  });

  it('revert only from active', () => {
    expect(canRevertDraft('active')).toBe(true);
    expect(canRevertDraft('draft')).toBe(false);
  });
});
