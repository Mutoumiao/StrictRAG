/**
 * 目标：KB deptAclEnforce 覆盖 env，未写时展示与运行时分钉。
 * 需求：P3b-KBENF
 * 被测：parseDeptAclEnforceFromConfig / resolveDeptAclEnforce
 * 简介：P3b-KBENF。
 */

import { describe, expect, it } from 'vitest';

import {
  buildKbSettingsView,
  mergeKbSettingsPatch,
  parseDeptAclEnforceFromConfig,
  resolveDeptAclEnforce,
} from '../../src/services/kb-settings.js';

describe('P3b-KBENF deptAclEnforce parse / resolve', () => {
  it('parse 仅字面 true/false，其余/缺省 → undefined', () => {
    expect(parseDeptAclEnforceFromConfig({ deptAclEnforce: true })).toBe(true);
    expect(parseDeptAclEnforceFromConfig({ deptAclEnforce: false })).toBe(false);
    expect(parseDeptAclEnforceFromConfig({})).toBeUndefined();
    expect(parseDeptAclEnforceFromConfig(null)).toBeUndefined();
    expect(parseDeptAclEnforceFromConfig({ deptAclEnforce: 'true' })).toBeUndefined();
    expect(parseDeptAclEnforceFromConfig({ deptAclEnforce: 1 })).toBeUndefined();
  });

  it('KB true 盖过 env false；KB false 盖过 env true；未写跟 env', () => {
    const prev = process.env.DEPT_ACL_ENFORCE;
    try {
      process.env.DEPT_ACL_ENFORCE = 'false';
      expect(resolveDeptAclEnforce(true)).toBe(true);
      expect(resolveDeptAclEnforce(undefined)).toBe(false);
      process.env.DEPT_ACL_ENFORCE = 'true';
      expect(resolveDeptAclEnforce(false)).toBe(false);
      expect(resolveDeptAclEnforce(undefined)).toBe(true);
    } finally {
      if (prev === undefined) delete process.env.DEPT_ACL_ENFORCE;
      else process.env.DEPT_ACL_ENFORCE = prev;
    }
  });

  it('GET 未写 → 回读 false（与运行时未写跟 env 分钉）', () => {
    const quality = { tauClaim: 0.5 };
    expect(
      buildKbSettingsView({
        row: { id: '01900000-0000-7000-8000-000000000099', name: 'KB', description: null, configJson: {} },
        quality,
      }).deptAclEnforce,
    ).toBe(false);
    expect(
      buildKbSettingsView({
        row: {
          id: '01900000-0000-7000-8000-000000000099',
          name: 'KB',
          description: null,
          configJson: { deptAclEnforce: true },
        },
        quality,
      }).deptAclEnforce,
    ).toBe(true);
  });

  it('PATCH 只在带键时写入；不带键保留未写', () => {
    const row = {
      id: '01900000-0000-7000-8000-000000000099',
      name: 'KB',
      description: null,
      configJson: {},
    };
    const nameOnly = mergeKbSettingsPatch(row, { name: 'KB2' });
    expect(nameOnly.ok).toBe(true);
    if (nameOnly.ok) {
      expect(nameOnly.configJson).not.toHaveProperty('deptAclEnforce');
    }
    const on = mergeKbSettingsPatch(row, { deptAclEnforce: true });
    expect(on.ok).toBe(true);
    if (on.ok) {
      expect(on.configJson.deptAclEnforce).toBe(true);
      expect(on.diff.deptAclEnforce).toEqual({ from: undefined, to: true });
    }
    const off = mergeKbSettingsPatch(row, { deptAclEnforce: false });
    expect(off.ok).toBe(true);
    if (off.ok) {
      expect(off.configJson.deptAclEnforce).toBe(false);
      expect(off.diff.deptAclEnforce).toEqual({ from: undefined, to: false });
    }
  });

  it('运行时未写跟 env：env true → 滤；GET 仍展示 false', () => {
    const prev = process.env.DEPT_ACL_ENFORCE;
    process.env.DEPT_ACL_ENFORCE = 'true';
    try {
      expect(resolveDeptAclEnforce(parseDeptAclEnforceFromConfig({}))).toBe(true);
      expect(
        buildKbSettingsView({
          row: {
            id: '01900000-0000-7000-8000-000000000099',
            name: 'KB',
            description: null,
            configJson: {},
          },
          quality: { tauClaim: 0.5 },
        }).deptAclEnforce,
      ).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DEPT_ACL_ENFORCE;
      else process.env.DEPT_ACL_ENFORCE = prev;
    }
  });
});
