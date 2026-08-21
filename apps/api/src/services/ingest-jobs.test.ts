import { describe, expect, it } from 'vitest';

import { toIngestJobListItem } from './ingest-jobs.js';

describe('toIngestJobListItem', () => {
  it('maps ledger row without rewriting status', () => {
    const item = toIngestJobListItem({
      id: '01900000-0000-7000-8000-0000000000j1',
      docId: '01900000-0000-7000-8000-0000000000d1',
      jobName: 'parse',
      status: 'failed',
      errorMessage: 'NO_TEXT_LAYER',
      indexVersion: 1,
      createdAt: '2026-08-21 00:00:00',
    });
    expect(item.jobName).toBe('parse');
    expect(item.status).toBe('failed');
    expect(item.errorMessage).toBe('NO_TEXT_LAYER');
  });
});
