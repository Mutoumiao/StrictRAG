/**
 * 目标：KB 允许的 mode/docTypes 必须正确解析，非法请求拒绝。
 * 需求：B2-W
 * 被测：resolveAskMode / parseDocTypesFromConfig / assertScopeDocTypesAllowed
 * 简介：B2-W resolveAskMode / docTypes。
 */

import { describe, expect, it } from 'vitest';

import {
  assertScopeDocTypesAllowed,
  parseDocTypesFromConfig,
  parseModesFromConfig,
  resolveAskMode,
} from '../../src/services/kb-settings.js';

describe('B2-W resolveAskMode / docTypes', () => {
  it('缺省 mode → defaultMode；非法 mode 拒绝', () => {
    const modes = { allowedModes: ['strict', 'balanced'] as const, defaultMode: 'balanced' as const };
    expect(resolveAskMode({ allowedModes: modes.allowedModes, defaultMode: modes.defaultMode })).toEqual({
      ok: true,
      mode: 'balanced',
    });
    expect(
      resolveAskMode({
        requested: 'strict',
        allowedModes: modes.allowedModes,
        defaultMode: modes.defaultMode,
      }),
    ).toEqual({ ok: true, mode: 'strict' });
    const bad = resolveAskMode({
      requested: 'fast',
      allowedModes: modes.allowedModes,
      defaultMode: modes.defaultMode,
    });
    expect(bad.ok).toBe(false);
  });

  it('docTypes 读写对称：config 解析 + scope 子集闸', () => {
    expect(parseDocTypesFromConfig({ docTypes: ['hr', 'it'] })).toEqual(['hr', 'it']);
    expect(parseDocTypesFromConfig({})).toEqual([]);
    expect(
      assertScopeDocTypesAllowed({ scopeDocTypes: ['hr'], kbDocTypes: ['hr', 'it'] }).ok,
    ).toBe(true);
    const rej = assertScopeDocTypesAllowed({
      scopeDocTypes: ['legal'],
      kbDocTypes: ['hr'],
    });
    expect(rej.ok).toBe(false);
    // KB 未配置限制 → 任意 scope 放行
    expect(
      assertScopeDocTypesAllowed({ scopeDocTypes: ['x'], kbDocTypes: [] }).ok,
    ).toBe(true);
  });

  it('parseModesFromConfig 缺省全量 balanced', () => {
    const m = parseModesFromConfig(null);
    expect(m.defaultMode).toBe('balanced');
    expect(m.allowedModes).toContain('fast');
  });
});
