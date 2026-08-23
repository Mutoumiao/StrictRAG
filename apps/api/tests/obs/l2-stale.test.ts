/**
 * 目标：rewrite dogfood 下 L2 指纹过期才告警。
 * 需求：ARCH-P2-4
 * 被测：evaluateL2Stale
 * 简介：rewrite dogfood 下 L2 指纹过期才告警。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/logger.js';
import { evaluateL2Stale, metricGet, metricsReset } from '../../src/obs/index.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

describe('evaluateL2Stale', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('rewriteEnvOn=false 或缺省 → 即使 last=null 也不告', () => {
    evaluateL2Stale({ current: 'cur', last: null });
    evaluateL2Stale({ rewriteEnvOn: false, current: 'cur', last: null });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('rewriteEnvOn=true 且 last 缺失 → alert=1 + Pino two-arg warn；第二次不 +1', () => {
    evaluateL2Stale({ rewriteEnvOn: true, current: 'cur' });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'l3_guard', kind: 'l2_stale' }),
      'l3 guard alert',
    );

    evaluateL2Stale({ rewriteEnvOn: true, current: 'cur', last: null });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('last === current → 不告', () => {
    evaluateL2Stale({ rewriteEnvOn: true, current: 'same', last: 'same' });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('last !== current → 告一次', () => {
    evaluateL2Stale({ rewriteEnvOn: true, current: 'now', last: 'old' });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'l3_guard', kind: 'l2_stale' }),
      'l3 guard alert',
    );

    evaluateL2Stale({ rewriteEnvOn: true, current: 'now', last: 'old' });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('metricsReset 清闩', () => {
    evaluateL2Stale({ rewriteEnvOn: true, current: 'now', last: null });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);

    metricsReset();
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(0);

    evaluateL2Stale({ rewriteEnvOn: true, current: 'now', last: null });
    expect(metricGet('l3_guard_alert_total', { kind: 'l2_stale' })).toBe(1);
  });
});
