import { beforeEach } from 'vitest';

import {
  clearTraceRecords,
  metricsReset,
  resetRateLimitStore,
} from '../../../src/obs/index.js';

export function installObsReset(): void {
  beforeEach(() => {
    metricsReset();
    clearTraceRecords();
    resetRateLimitStore();
  });
}
