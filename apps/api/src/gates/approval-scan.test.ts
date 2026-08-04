import { BizCode } from '@strict-rag/contracts';
import { describe, expect, it } from 'vitest';

function canEnqueueScan(approvalStatus: string): boolean {
  return approvalStatus === 'approved';
}

/** 未批 scan 对外码（PRD 短名） */
function scanDeniedCode(): typeof BizCode.FORBIDDEN {
  return BizCode.FORBIDDEN;
}

describe('approval scan gate', () => {
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
