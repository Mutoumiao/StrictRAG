/**
 * 目标：面板 summary 必须含四项指标，拒绝未知字段。
 * 需求：B6
 * 被测：DashboardSummarySchema
 * 简介：面板 summary 形状。
 */

import { describe, expect, it } from 'vitest';

import { DashboardSummarySchema } from '../../src/system/dashboard.contract.js';

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
