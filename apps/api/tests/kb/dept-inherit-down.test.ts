/**
 * 目标：KB deptInheritDown 覆盖 env，祖先在关闭向下继承时不可见子孙。
 * 需求：P3b-KBINH
 * 被测：parseDeptInheritDownFromConfig / resolveDeptInheritDown / filterDocsForDeptAcl
 * 简介：P3b-KBINH。
 */

import { describe, expect, it } from 'vitest';

import {
  buildKbSettingsView,
  mergeKbSettingsPatch,
  parseDeptInheritDownFromConfig,
  resolveDeptInheritDown,
} from '../../src/services/kb-settings.js';
import { filterDocsForDeptAcl } from '../../src/services/retrieve/dept-acl.js';

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
