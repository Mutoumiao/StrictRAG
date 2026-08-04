import { describe, expect, it } from 'vitest';

import { canBecomeActive, canEnqueueScan, scanDeniedCode } from './approval-scan.js';

describe('approval scan gate (ADR-048, shared with scan route)', () => {
  it('blocks pending / none / rejected', () => {
    expect(canEnqueueScan('pending')).toBe(false);
    expect(canEnqueueScan('none')).toBe(false);
    expect(canEnqueueScan('rejected')).toBe(false);
  });

  it('allows approved', () => {
    expect(canEnqueueScan('approved')).toBe(true);
  });

  it('uses PRD short code FORBIDDEN', () => {
    expect(scanDeniedCode()).toBe('FORBIDDEN');
  });
});

describe('lifecycle active gate (shared with PATCH route)', () => {
  it('only ready can become active', () => {
    expect(canBecomeActive('ready')).toBe(true);
    expect(canBecomeActive('uploaded')).toBe(false);
    expect(canBecomeActive('indexing_es')).toBe(false);
    expect(canBecomeActive('needs_ocr')).toBe(false);
  });
});
