import { describe, expect, it } from 'vitest';

import {
  assertScopeDocTypesAllowed,
  isSensitiveCompleteBlocked,
  parseDataClassFromConfig,
  parseDocTypesFromConfig,
  parseModesFromConfig,
  resolveAskMode,
} from './kb-settings.js';

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

describe('P3b-SENS dataClass / complete 闸', () => {
  it('parseDataClassFromConfig 只认 sensitive，其余/缺省 → internal', () => {
    expect(parseDataClassFromConfig({ dataClass: 'sensitive' })).toBe('sensitive');
    expect(parseDataClassFromConfig({ dataClass: 'internal' })).toBe('internal');
    expect(parseDataClassFromConfig({})).toBe('internal');
    expect(parseDataClassFromConfig(null)).toBe('internal');
    expect(parseDataClassFromConfig({ dataClass: 'public' })).toBe('internal');
  });

  it('internal 不挡；sensitive + 无 enforce 挡', () => {
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'internal',
        ownerDeptId: null,
        deptAclEnforce: undefined,
      }),
    ).toBe(false);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
        deptAclEnforce: undefined,
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
        deptAclEnforce: 'false',
      }),
    ).toBe(true);
  });

  it('sensitive + enforce true：无 owner 挡，有 owner 放行', () => {
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: null,
        deptAclEnforce: 'true',
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '',
        deptAclEnforce: 'true',
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
        deptAclEnforce: 'true',
      }),
    ).toBe(false);
  });
});
