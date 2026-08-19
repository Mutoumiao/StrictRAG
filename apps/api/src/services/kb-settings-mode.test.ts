import { describe, expect, it } from 'vitest';

import {
  assertScopeDocTypesAllowed,
  buildKbSettingsView,
  isSensitiveCompleteBlocked,
  mergeKbSettingsPatch,
  parseDataClassFromConfig,
  parseDeptAclEnforceFromConfig,
  parseDeptInheritDownFromConfig,
  parseDocTypesFromConfig,
  parseModesFromConfig,
  resolveAskMode,
  resolveDeptAclEnforce,
  resolveDeptInheritDown,
} from './kb-settings.js';
import { filterDocsForDeptAcl } from './retrieve/dept-acl.js';

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
        deptAclEnforce: false,
      }),
    ).toBe(false);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
        deptAclEnforce: false,
      }),
    ).toBe(true);
  });

  it('sensitive + enforce true：无 owner 挡，有 owner 放行', () => {
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: null,
        deptAclEnforce: true,
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '',
        deptAclEnforce: true,
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
        deptAclEnforce: true,
      }),
    ).toBe(false);
  });
});

describe('P3b-KBINH deptInheritDown parse / resolve', () => {
  it('parse 仅字面 true/false，其余/缺省 → undefined', () => {
    expect(parseDeptInheritDownFromConfig({ deptInheritDown: true })).toBe(true);
    expect(parseDeptInheritDownFromConfig({ deptInheritDown: false })).toBe(false);
    expect(parseDeptInheritDownFromConfig({})).toBeUndefined();
    expect(parseDeptInheritDownFromConfig(null)).toBeUndefined();
    expect(parseDeptInheritDownFromConfig({ deptInheritDown: 'false' })).toBeUndefined();
    expect(parseDeptInheritDownFromConfig({ deptInheritDown: 0 })).toBeUndefined();
  });

  it('KB false 盖过 env true；KB true 盖过 env false；未写跟 env', () => {
    const prev = process.env.DEPT_INHERIT_DOWN;
    try {
      process.env.DEPT_INHERIT_DOWN = 'true';
      expect(resolveDeptInheritDown(false)).toBe(false);
      expect(resolveDeptInheritDown(undefined)).toBe(true);
      process.env.DEPT_INHERIT_DOWN = 'false';
      expect(resolveDeptInheritDown(true)).toBe(true);
      expect(resolveDeptInheritDown(undefined)).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.DEPT_INHERIT_DOWN;
      else process.env.DEPT_INHERIT_DOWN = prev;
    }
  });

  it('GET 未写 → 回读 true；已写回读字面值', () => {
    const quality = { tauClaim: 0.5 };
    expect(
      buildKbSettingsView({
        row: { id: '01900000-0000-7000-8000-000000000099', name: 'KB', description: null, configJson: {} },
        quality,
      }).deptInheritDown,
    ).toBe(true);
    expect(
      buildKbSettingsView({
        row: {
          id: '01900000-0000-7000-8000-000000000099',
          name: 'KB',
          description: null,
          configJson: { deptInheritDown: false },
        },
        quality,
      }).deptInheritDown,
    ).toBe(false);
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
      expect(nameOnly.configJson).not.toHaveProperty('deptInheritDown');
    }
    const off = mergeKbSettingsPatch(row, { deptInheritDown: false });
    expect(off.ok).toBe(true);
    if (off.ok) {
      expect(off.configJson.deptInheritDown).toBe(false);
      expect(off.diff.deptInheritDown).toEqual({ from: undefined, to: false });
    }
  });

  it('enforce + 祖先 + KB false → 子孙不可见、精确仍可见；grant 不被关', () => {
    const prev = process.env.DEPT_INHERIT_DOWN;
    process.env.DEPT_INHERIT_DOWN = 'true';
    try {
      const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
      const DEPT_B = '01900000-0000-7000-8000-0000000000b1';
      const tree = [
        { id: DEPT_A, path: `/${DEPT_A}/` },
        { id: DEPT_B, path: `/${DEPT_A}/${DEPT_B}/` },
      ];
      const docs = [
        { id: 'lib', ownerDeptId: null, visibilityLevel: 20 },
        { id: 'a20', ownerDeptId: DEPT_A, visibilityLevel: 20 },
        { id: 'b20', ownerDeptId: DEPT_B, visibilityLevel: 20 },
      ];
      const inheritDown = resolveDeptInheritDown(
        parseDeptInheritDownFromConfig({ deptInheritDown: false }),
      );
      expect(inheritDown).toBe(false);
      const ancestorIds = filterDocsForDeptAcl(docs, {
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        enforce: true,
        depts: tree,
        inheritDown,
      }).map((d) => d.id);
      expect(ancestorIds).toEqual(['lib', 'a20']);
      expect(ancestorIds).not.toContain('b20');

      const exactIds = filterDocsForDeptAcl(docs, {
        assignments: [{ deptId: DEPT_B, isLeader: false }],
        enforce: true,
        depts: tree,
        inheritDown,
      }).map((d) => d.id);
      expect(exactIds).toEqual(['lib', 'b20']);

      const grantIds = filterDocsForDeptAcl(docs, {
        assignments: [],
        enforce: true,
        depts: tree,
        grants: [{ deptId: DEPT_B, maxVisibilityLevel: 20, expiresAt: null }],
        inheritDown,
      }).map((d) => d.id);
      expect(grantIds).toEqual(['lib', 'b20']);

      const off = filterDocsForDeptAcl(docs, {
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        enforce: false,
        depts: tree,
        inheritDown,
      }).map((d) => d.id);
      expect(off).toEqual(['lib', 'a20', 'b20']);
    } finally {
      if (prev === undefined) delete process.env.DEPT_INHERIT_DOWN;
      else process.env.DEPT_INHERIT_DOWN = prev;
    }
  });
});

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
