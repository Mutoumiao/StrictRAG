/**
 * 目标：面板 summary 必须含四项指标且拒未知字段；双轨 tracks 不得塞进 summary。
 * 需求：B6 · 剧本 I4
 * 被测：DashboardSummarySchema / DashboardTracksSchema
 * 简介：summary 冻结 ≤5；质量/延迟走独立信封。
 */

import { describe, expect, it } from 'vitest';

import {
  DashboardSummarySchema,
  DashboardTracksSchema,
} from '../../src/system/dashboard.contract.js';

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

  it('tracks 接受空质量与零延迟', () => {
    const r = DashboardTracksSchema.safeParse({
      quality: {
        evalRunId: null,
        retrieveMode: null,
        matrix: null,
        coverage: null,
        hitAtK: null,
        tauStar: null,
        judgeAuroc: null,
      },
      latency: {
        windowHours: 24,
        askCount: 0,
        scoredCount: 0,
        avgMs: null,
        p95Ms: null,
      },
    });
    expect(r.success).toBe(true);
  });

  it('tracks 拒未知字段；summary 不得靠 tracks 字段过关', () => {
    const tracks = DashboardTracksSchema.safeParse({
      quality: {
        evalRunId: null,
        retrieveMode: null,
        matrix: null,
        coverage: null,
        hitAtK: null,
        tauStar: null,
        judgeAuroc: null,
      },
      latency: {
        windowHours: 24,
        askCount: 0,
        scoredCount: 0,
        avgMs: null,
        p95Ms: null,
      },
      extra: true,
    });
    expect(tracks.success).toBe(false);

    const stuffed = DashboardSummarySchema.safeParse({
      kbCount: 0,
      documentCount: 0,
      pendingApprovalCount: 0,
      processReady: true,
      quality: { evalRunId: null },
    });
    expect(stuffed.success).toBe(false);
  });
});
