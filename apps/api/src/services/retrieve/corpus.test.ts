import { describe, expect, it } from 'vitest';

import { filterDocsForRetrieve } from './corpus.js';

describe('filterDocsForRetrieve（语料装载双闸门）', () => {
  const base = [
    { id: 'a', status: 'ready', lifecycle: 'active', docType: 'hr' },
    { id: 'b', status: 'ready', lifecycle: 'draft', docType: 'hr' },
    { id: 'c', status: 'embedding', lifecycle: 'active', docType: 'hr' },
    { id: 'd', status: 'ready', lifecycle: 'superseded', docType: 'tech' },
    { id: 'e', status: 'ready', lifecycle: 'active', docType: 'tech' },
    { id: 'f', status: 'failed', lifecycle: 'active', docType: 'hr' },
  ] as const;

  it('excludes draft / superseded / non-ready', () => {
    const ids = filterDocsForRetrieve([...base]).map((d) => d.id);
    expect(ids).toEqual(['a', 'e']);
  });

  it('scope.docTypes filters after dual gate', () => {
    const ids = filterDocsForRetrieve([...base], { docTypes: ['hr'] }).map((d) => d.id);
    expect(ids).toEqual(['a']);
  });

  it('empty scope.docTypes does not filter types', () => {
    const ids = filterDocsForRetrieve([...base], { docTypes: [] }).map((d) => d.id);
    expect(ids).toEqual(['a', 'e']);
  });

  it('missing docType never matches non-empty scope', () => {
    const docs = [
      { id: 'x', status: 'ready', lifecycle: 'active', docType: null },
      { id: 'y', status: 'ready', lifecycle: 'active', docType: 'hr' },
    ];
    expect(filterDocsForRetrieve(docs, { docTypes: ['hr'] }).map((d) => d.id)).toEqual(['y']);
  });
});
