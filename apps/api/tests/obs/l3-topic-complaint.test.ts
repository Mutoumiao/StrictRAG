/**
 * 目标：主题投诉计数满阈只告一次。
 * 需求：ARCH-P2-4
 * 被测：recordL3TopicComplaint
 * 简介：主题投诉计数满阈只告一次。
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/logger.js';
import {
  L3_TOPIC_COMPLAINT_THRESHOLD,
  metricGet,
  metricsReset,
  recordL3TopicComplaint,
} from '../../src/obs/index.js';
import { installObsReset } from './_support/reset.js';

installObsReset();

describe('recordL3TopicComplaint', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  afterEach(() => {
    warn.mockRestore();
  });

  it('无 session 不加', () => {
    recordL3TopicComplaint({ hasSession: false });
    expect(metricGet('l3_topic_complaint_total')).toBe(0);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('有 session +1', () => {
    recordL3TopicComplaint({ hasSession: true });
    expect(metricGet('l3_topic_complaint_total')).toBe(1);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(0);
    expect(warn).not.toHaveBeenCalled();
  });

  it('满 5 只告 topic_complaint 一次；第二次 down 不再 +alert', () => {
    expect(L3_TOPIC_COMPLAINT_THRESHOLD).toBe(5);
    for (let i = 0; i < L3_TOPIC_COMPLAINT_THRESHOLD; i += 1) {
      recordL3TopicComplaint({ hasSession: true });
    }
    expect(metricGet('l3_topic_complaint_total')).toBe(5);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      { event: 'l3_guard', kind: 'topic_complaint', complaints: 5 },
      'l3 guard alert',
    );

    recordL3TopicComplaint({ hasSession: true });
    expect(metricGet('l3_topic_complaint_total')).toBe(6);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('metricsReset 后闩与计数清零', () => {
    for (let i = 0; i < L3_TOPIC_COMPLAINT_THRESHOLD; i += 1) {
      recordL3TopicComplaint({ hasSession: true });
    }
    expect(metricGet('l3_topic_complaint_total')).toBe(5);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(1);

    metricsReset();
    expect(metricGet('l3_topic_complaint_total')).toBe(0);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(0);

    recordL3TopicComplaint({ hasSession: true });
    expect(metricGet('l3_topic_complaint_total')).toBe(1);
    expect(metricGet('l3_guard_alert_total', { kind: 'topic_complaint' })).toBe(0);
  });
});
