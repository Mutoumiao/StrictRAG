import { describe, expect, it } from 'vitest';

import { filterDefaultRetrievable, isDefaultRetrievable } from './retrieval-gate.js';

describe('default retrieval gate', () => {
  it('allows only ready ∧ active', () => {
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'active' })).toBe(true);
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'draft' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'superseded' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'embedding', lifecycle: 'active' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'needs_ocr', lifecycle: 'active' })).toBe(false);
  });

  it('filters collection', () => {
    const docs = [
      { id: '1', status: 'ready', lifecycle: 'active' },
      { id: '2', status: 'ready', lifecycle: 'draft' },
      { id: '3', status: 'failed', lifecycle: 'active' },
    ];
    expect(filterDefaultRetrievable(docs).map((d) => d.id)).toEqual(['1']);
  });
});
