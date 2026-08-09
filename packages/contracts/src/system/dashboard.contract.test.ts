import { describe, expect, it } from 'vitest';

import { DashboardSummarySchema } from './dashboard.contract.js';

describe('dashboard.contract', () => {
  it('accepts four required metrics + optional askCount24h', () => {
    const r = DashboardSummarySchema.safeParse({
      kbCount: 1,
      documentCount: 2,
      pendingApprovalCount: 0,
      processReady: true,
      askCount24h: 3,
    });
    expect(r.success).toBe(true);
  });

  it('accepts without askCount24h', () => {
    const r = DashboardSummarySchema.safeParse({
      kbCount: 0,
      documentCount: 0,
      pendingApprovalCount: 0,
      processReady: false,
    });
    expect(r.success).toBe(true);
  });

  it('rejects unknown field (strict)', () => {
    const r = DashboardSummarySchema.safeParse({
      kbCount: 0,
      documentCount: 0,
      pendingApprovalCount: 0,
      processReady: true,
      extra: 1,
    });
    expect(r.success).toBe(false);
  });

  it('rejects non-boolean processReady', () => {
    const r = DashboardSummarySchema.safeParse({
      kbCount: 0,
      documentCount: 0,
      pendingApprovalCount: 0,
      processReady: 'yes',
    });
    expect(r.success).toBe(false);
  });
});
