import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from './queues.js';

describe('QUEUE_NAMES', () => {
  it('exposes probe queue constant', () => {
    expect(QUEUE_NAMES.PROBE).toBe('sr-probe');
    expect(QUEUE_NAMES.INGEST).toBe('sr-ingest');
  });
});
