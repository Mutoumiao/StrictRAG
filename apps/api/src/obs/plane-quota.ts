/**
 * 三平面配额的「缺配置安全默认」（剧本 R10 · prds/07-models §7 禁止项：
 * staging/prod **无** plane 配额配置裸奔 → 缺则 **warning + 安全默认值**，**非 fail closed**）。
 *
 * 口径：
 * - `>0` = 显式配置，原样生效。
 * - `0` 在 dev / test 表示**关闭**（仓库默认，行为逐位不变）；在 staging / production 表示**裸奔**，
 *   回落 `SAFE_DEFAULT_PLANE_RPM` 并告警。
 * - 任何情况下都不拒绝启动：本模块只调整数值与告警，不做 exit。
 *
 * 非目标：集群配额、Redis 共享窗口、embed TPM（见 docs/ops/rate-limit-and-metrics.md 否决项）。
 */

import { env, type ApiEnv } from '../env.js';

/**
 * staging / production 缺配置时的安全默认 RPM。
 * 数值取本仓运维文档 `docs/ops/rate-limit-and-metrics.md` §2.1 的试点建议值（30），不另发明量级。
 */
export const SAFE_DEFAULT_PLANE_RPM = 30;

export type PlaneQuotaPlane = 'ask' | 'ingest';

export type PlaneQuota = {
  /** 生效 RPM；0 = 不限流 */
  rpm: number;
  /** true = staging/production 下缺配置，已回落安全默认 */
  usedSafeDefault: boolean;
};

export function resolvePlaneQuota(
  appEnv: ApiEnv['APP_ENV'],
  configuredRpm: number,
): PlaneQuota {
  if (configuredRpm > 0) return { rpm: configuredRpm, usedSafeDefault: false };
  if (appEnv === 'staging' || appEnv === 'production') {
    return { rpm: SAFE_DEFAULT_PLANE_RPM, usedSafeDefault: true };
  }
  return { rpm: 0, usedSafeDefault: false };
}

export type PlaneQuotaEnvSlice = Pick<
  ApiEnv,
  'APP_ENV' | 'ASK_RATE_LIMIT_RPM' | 'INGEST_RATE_LIMIT_RPM'
>;

export function planeQuotasFromEnv(
  source: PlaneQuotaEnvSlice,
): Record<PlaneQuotaPlane, PlaneQuota> {
  return {
    ask: resolvePlaneQuota(source.APP_ENV, source.ASK_RATE_LIMIT_RPM),
    ingest: resolvePlaneQuota(source.APP_ENV, source.INGEST_RATE_LIMIT_RPM),
  };
}

/** 进程内只决议一次；路由与启动告警共用同一份，避免各算各的 */
export const planeQuotas = planeQuotasFromEnv(env);

export type WarnSink = { warn: (obj: Record<string, unknown>, msg: string) => void };

/** 启动时调用一次：仅对回落安全默认的平面告警（非 fail closed） */
export function logPlaneQuotaGaps(log: WarnSink, quotas = planeQuotas): void {
  for (const [plane, quota] of Object.entries(quotas) as [PlaneQuotaPlane, PlaneQuota][]) {
    if (!quota.usedSafeDefault) continue;
    log.warn(
      { plane, rpm: quota.rpm },
      'plane quota missing for staging/production; using safe default (not fail closed)',
    );
  }
}
