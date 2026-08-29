/**
 * 目标：入库与探测队列名常量不得漂移。
 * 需求：prds/06-async
 * 被测：QUEUE_NAMES
 * 简介：暴露 sr-probe / sr-ingest / sr-eval。
 */
import { describe, expect, it } from 'vitest';

import { QUEUE_NAMES } from '../../src/queues.js';

describe('QUEUE_NAMES', () => {
  it('exposes probe queue constant', () => {
    expect(QUEUE_NAMES.PROBE).toBe('sr-probe');
    expect(QUEUE_NAMES.INGEST).toBe('sr-ingest');
    expect(QUEUE_NAMES.EVAL).toBe('sr-eval');
  });
});
