/**
 * 目标：扫描模式运行时拦截与启动策略一致。
 * 需求：X-02
 * 被测：isScanModeRuntimeBlocked（pipeline 接线）
 * 简介：on 运行时拦截不得当 clean。
 */
import { describe, expect, it } from 'vitest';

import { isScanModeRuntimeBlocked } from '../../src/scan-mode-policy.js';

describe('scan mode runtime · X-02', () => {
  it('on 在运行时被拦截（不得 clean）', () => {
    expect(isScanModeRuntimeBlocked('on')).toBe(true);
  });
});
