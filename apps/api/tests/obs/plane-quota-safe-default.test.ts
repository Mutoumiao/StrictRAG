/**
 * 目标：staging/production 缺 plane 配额时回落安全默认并告警，且不拒绝启动。
 * 需求：剧本 R10 · prds/07-models §7 禁止项「无 plane 配额配置裸奔 → warning + 安全默认，非 fail closed」
 * 被测：resolvePlaneQuota / planeQuotasFromEnv / logPlaneQuotaGaps / checkFixedWindowRateLimit
 * 简介：dev·test 的 0 仍是关闭（仓库默认不变）；staging·production 的 0 变安全默认且只对该平面告警；显式正数原样生效。
 */

import { describe, expect, it, vi } from 'vitest';

import {
  SAFE_DEFAULT_PLANE_RPM,
  checkFixedWindowRateLimit,
  logPlaneQuotaGaps,
  planeQuotasFromEnv,
  resolvePlaneQuota,
  type RateLimitStore,
} from '../../src/obs/index.js';

describe('plane quota 缺配置安全默认（R10）', () => {
  it('dev / test：0 仍是关闭，与仓库默认一致', () => {
    expect(resolvePlaneQuota('development', 0)).toEqual({ rpm: 0, usedSafeDefault: false });
    expect(resolvePlaneQuota('test', 0)).toEqual({ rpm: 0, usedSafeDefault: false });
  });

  it('staging / production：0 → 安全默认（不裸奔、也不拒绝启动）', () => {
    for (const appEnv of ['staging', 'production'] as const) {
      const quota = resolvePlaneQuota(appEnv, 0);
      expect(quota.usedSafeDefault).toBe(true);
      expect(quota.rpm).toBe(SAFE_DEFAULT_PLANE_RPM);
      expect(quota.rpm).toBeGreaterThan(0);
    }
  });

  it('显式正数原样生效：不覆盖运维的真配置', () => {
    expect(resolvePlaneQuota('production', 45)).toEqual({ rpm: 45, usedSafeDefault: false });
    expect(resolvePlaneQuota('staging', 7)).toEqual({ rpm: 7, usedSafeDefault: false });
  });

  it('安全默认确实限流：超过 rpm 即失败，不是无限放行', () => {
    const store: RateLimitStore = new Map();
    const options = { limit: SAFE_DEFAULT_PLANE_RPM, store, now: () => 1_000 };
    for (let i = 0; i < SAFE_DEFAULT_PLANE_RPM; i += 1) {
      expect(checkFixedWindowRateLimit('ask:user:kb', options).ok).toBe(true);
    }
    expect(checkFixedWindowRateLimit('ask:user:kb', options).ok).toBe(false);
  });

  it('告警只对回落安全默认的平面发出', () => {
    const warn = vi.fn();
    logPlaneQuotaGaps(
      { warn },
      {
        ask: resolvePlaneQuota('production', 0),
        ingest: resolvePlaneQuota('production', 20),
      },
    );
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatchObject({
      plane: 'ask',
      rpm: SAFE_DEFAULT_PLANE_RPM,
    });
  });

  it('dev / test 不告警：仓库默认不打开限流', () => {
    const warn = vi.fn();
    logPlaneQuotaGaps(
      { warn },
      planeQuotasFromEnv({ APP_ENV: 'test', ASK_RATE_LIMIT_RPM: 0, INGEST_RATE_LIMIT_RPM: 0 }),
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
