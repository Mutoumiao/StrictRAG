/**
 * 目标：L3 ask 计数与护栏告警闩按阈值只告一次。
 * 需求：ARCH-P2-4
 * 被测：recordL3Ask
 * 简介：L3 ask 计数满阈只告一次，护栏告警有闩。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/logger.js';
import {
  L3_CORE_FAIL_RATE_MIN_SESSION,
  L3_CORE_FAIL_RATE_THRESHOLD,
  metricGet,
  metricsReset,
  recordL3Ask,
} from '../../src/obs/index.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

describe('recordL3Ask', () => {
  it('rewriteUsed true +1；false 不加', () => {
    recordL3Ask({ rewriteUsed: true, reason: 'verified', hasSession: false });
    expect(metricGet('l3_rewrite_used_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    expect(metricGet('l3_rewrite_used_total')).toBe(1);
  });

  it('reason=coref_unresolved +1；其它 reason 不加', () => {
    recordL3Ask({ rewriteUsed: false, reason: 'coref_unresolved', hasSession: false });
    expect(metricGet('l3_coref_fail_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    expect(metricGet('l3_coref_fail_total')).toBe(1);
  });

  it('hasSession true +1；false 不加', () => {
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    expect(metricGet('l3_session_ask_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    expect(metricGet('l3_session_ask_total')).toBe(1);
  });

  it('sessionDeepened true +1；缺省/false 不加', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      sessionDeepened: true,
    });
    expect(metricGet('l3_session_deepened_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      sessionDeepened: false,
    });
    expect(metricGet('l3_session_deepened_total')).toBe(1);
  });

  it('documentBackref true +1；缺省/false 不加', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      documentBackref: true,
    });
    expect(metricGet('l3_document_backref_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      documentBackref: false,
    });
    expect(metricGet('l3_document_backref_total')).toBe(1);
  });

  it('externalBackref true +1；缺省/false 不加', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      externalBackref: true,
    });
    expect(metricGet('l3_external_backref_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      externalBackref: false,
    });
    expect(metricGet('l3_external_backref_total')).toBe(1);
  });

  it('metricsReset 后为 0', () => {
    recordL3Ask({
      rewriteUsed: true,
      reason: 'coref_unresolved',
      hasSession: true,
      sessionDeepened: true,
      documentBackref: true,
      externalBackref: true,
    });
    metricsReset();
    expect(metricGet('l3_rewrite_used_total')).toBe(0);
    expect(metricGet('l3_coref_fail_total')).toBe(0);
    expect(metricGet('l3_session_ask_total')).toBe(0);
    expect(metricGet('l3_session_deepened_total')).toBe(0);
    expect(metricGet('l3_document_backref_total')).toBe(0);
    expect(metricGet('l3_external_backref_total')).toBe(0);
  });
});

describe('recordL3Ask 护栏告警闩', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  function recordSessionAsks(
    n: number,
    reason: string,
    extra?: { rewriteEnvOn?: boolean },
  ): void {
    for (let i = 0; i < n; i += 1) {
      recordL3Ask({ rewriteUsed: false, reason, hasSession: true, ...extra });
    }
  }

  it('session≥min 且 fail 率达阈 → coref_fail_rate +1 且 Pino warn（AC1）', () => {
    const failN = Math.ceil(L3_CORE_FAIL_RATE_MIN_SESSION * L3_CORE_FAIL_RATE_THRESHOLD);
    const okN = L3_CORE_FAIL_RATE_MIN_SESSION - failN;
    recordSessionAsks(okN, 'verified');
    recordSessionAsks(failN, 'coref_unresolved');

    expect(L3_CORE_FAIL_RATE_MIN_SESSION).toBe(20);
    expect(L3_CORE_FAIL_RATE_THRESHOLD).toBe(0.2);
    expect(metricGet('l3_session_ask_total')).toBe(L3_CORE_FAIL_RATE_MIN_SESSION);
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'l3_guard',
        kind: 'coref_fail_rate',
        sessionAsk: L3_CORE_FAIL_RATE_MIN_SESSION,
        corefFail: failN,
      }),
      'l3 guard alert',
    );
  });

  it('session < min 全 fail 不告 coref_fail_rate（AC2）', () => {
    recordSessionAsks(L3_CORE_FAIL_RATE_MIN_SESSION - 1, 'coref_unresolved');
    expect(metricGet('l3_session_ask_total')).toBe(L3_CORE_FAIL_RATE_MIN_SESSION - 1);
    expect(metricGet('l3_coref_fail_total')).toBe(L3_CORE_FAIL_RATE_MIN_SESSION - 1);
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('同 kind 第二次不重复 +1（AC3）', () => {
    recordSessionAsks(L3_CORE_FAIL_RATE_MIN_SESSION, 'coref_unresolved');
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(1);
    recordSessionAsks(5, 'coref_unresolved');
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('rewriteEnvOn=true 告 dogfood；false/缺省不加（AC4）', () => {
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: false,
    });
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(0);

    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: true,
    });
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'l3_guard',
        kind: 'rewrite_dogfood',
        rewriteEnvOn: true,
      }),
      'l3 guard alert',
    );

    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: true,
    });
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(1);
  });

  it('metricsReset 清计数与闩，可再告（AC5）', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: true,
    });
    recordSessionAsks(L3_CORE_FAIL_RATE_MIN_SESSION, 'coref_unresolved');
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(1);
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(1);

    metricsReset();
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(0);
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(0);
    expect(metricGet('l3_session_ask_total')).toBe(0);
    expect(metricGet('l3_coref_fail_total')).toBe(0);

    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: false,
      rewriteEnvOn: true,
    });
    recordSessionAsks(L3_CORE_FAIL_RATE_MIN_SESSION, 'coref_unresolved');
    expect(metricGet('l3_guard_alert_total', { kind: 'rewrite_dogfood' })).toBe(1);
    expect(metricGet('l3_guard_alert_total', { kind: 'coref_fail_rate' })).toBe(1);
  });
});
