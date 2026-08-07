import { beforeEach, describe, expect, it } from 'vitest';

import { readStoredKbId, writeStoredKbId } from '@/lib/kb-context';

describe('kb-context', () => {
  beforeEach(() => localStorage.clear());

  it('写 admin KB key，不污染 web', () => {
    writeStoredKbId('kb-1');
    expect(readStoredKbId()).toBe('kb-1');
    expect(localStorage.getItem('strict-rag:admin:last-kb-id')).toBe('kb-1');
    expect(localStorage.getItem('strict-rag:web:last-kb-id')).toBeNull();
  });
});
