/**
 * 目标：扫描模式启动闸与运行时拦截一致；on 未接引擎须失败。
 * 需求：X-01/X-02
 * 被测：checkScanModeStartupPolicy · isScanModeRuntimeBlocked
 * 简介：development 允许 mock；任意 APP_ENV 下 on 拒绝；staging/production 禁止 mock/off。
 */
import { describe, expect, it } from 'vitest';

import {
  checkScanModeStartupPolicy,
  isScanModeRuntimeBlocked,
} from '../../src/scan-mode-policy.js';

describe('checkScanModeStartupPolicy · X-01 / X-02', () => {
  it('development 允许 mock_clean / mock_infected / off', () => {
    expect(checkScanModeStartupPolicy('development', 'mock_clean')).toBeNull();
    expect(checkScanModeStartupPolicy('development', 'mock_infected')).toBeNull();
    expect(checkScanModeStartupPolicy('development', 'off')).toBeNull();
    expect(checkScanModeStartupPolicy('test', 'mock_clean')).toBeNull();
  });

  it('任意 APP_ENV 下 on → 拒绝（未接真引擎）', () => {
    for (const appEnv of ['development', 'test', 'staging', 'production']) {
      const msg = checkScanModeStartupPolicy(appEnv, 'on');
      expect(msg).toBeTruthy();
      expect(msg).toMatch(/QUAL-2|real scan engine|on/i);
    }
  });

  it('staging/production 禁止 mock_* 与 off', () => {
    for (const appEnv of ['staging', 'production']) {
      for (const mode of ['mock_clean', 'mock_infected', 'off']) {
        const msg = checkScanModeStartupPolicy(appEnv, mode);
        expect(msg, `${appEnv}+${mode}`).toBeTruthy();
        expect(msg).toMatch(/fail-closed|forbids/i);
      }
    }
  });
});

describe('isScanModeRuntimeBlocked', () => {
  it('only on is blocked at runtime', () => {
    expect(isScanModeRuntimeBlocked('on')).toBe(true);
    expect(isScanModeRuntimeBlocked('mock_clean')).toBe(false);
    expect(isScanModeRuntimeBlocked('off')).toBe(false);
  });
});
