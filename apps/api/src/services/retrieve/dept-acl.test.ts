import { describe, expect, it } from 'vitest';

import {
  filterDocsForDeptAcl,
  isDocVisibleForDeptAcl,
  isGrantActive,
  loadDeptAssignments,
  loadDeptGrants,
  loadDeptNodes,
} from './dept-acl.js';

const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';
const DEPT_C = '01900000-0000-7000-8000-0000000000c1';

/** A 祖先，B/C 同级子孙 */
const tree = [
  { id: DEPT_A, path: `/${DEPT_A}/` },
  { id: DEPT_B, path: `/${DEPT_A}/${DEPT_B}/` },
  { id: DEPT_C, path: `/${DEPT_A}/${DEPT_C}/` },
];

const docs = [
  { id: 'lib', ownerDeptId: null, visibilityLevel: 20 },
  { id: 'a20', ownerDeptId: DEPT_A, visibilityLevel: 20 },
  { id: 'a30', ownerDeptId: DEPT_A, visibilityLevel: 30 },
  { id: 'b20', ownerDeptId: DEPT_B, visibilityLevel: 20 },
];

describe('filterDocsForDeptAcl', () => {
  it('enforce off → 原样', () => {
    expect(
      filterDocsForDeptAcl(docs, { assignments: [], enforce: false }).map((d) => d.id),
    ).toEqual(['lib', 'a20', 'a30', 'b20']);
  });

  it('同部门成员可见 20，不可见 30', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: false }],
      enforce: true,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20']);
  });

  it('同部门负责人可见 30', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: true }],
      enforce: true,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'a30']);
  });

  it('跨部门不可见', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_B, isLeader: false }],
      enforce: true,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'b20']);
  });

  it('无归属只见空部门且级别够', () => {
    const ids = filterDocsForDeptAcl(docs, { assignments: [], enforce: true }).map((d) => d.id);
    expect(ids).toEqual(['lib']);
  });

  it('空部门 + visibility 30：普通成员不可见，任意部门负责人可见', () => {
    const high = { id: 'lib30', ownerDeptId: null, visibilityLevel: 30 };
    expect(isDocVisibleForDeptAcl(high, [], true)).toBe(false);
    expect(isDocVisibleForDeptAcl(high, [{ deptId: DEPT_A, isLeader: false }], true)).toBe(false);
    expect(isDocVisibleForDeptAcl(high, [{ deptId: DEPT_A, isLeader: true }], true)).toBe(true);
  });

  it('visibility 缺省当 20', () => {
    expect(isDocVisibleForDeptAcl({ ownerDeptId: null }, [], true)).toBe(true);
  });

  it('userId / tenantId 缺 → 无归属，不抛', async () => {
    await expect(loadDeptAssignments(undefined, undefined)).resolves.toEqual([]);
    await expect(loadDeptAssignments('t1', undefined)).resolves.toEqual([]);
    await expect(loadDeptAssignments(undefined, 'u1')).resolves.toEqual([]);
  });

  it('tenant 缺 → 无树，不抛', async () => {
    await expect(loadDeptNodes(undefined)).resolves.toEqual([]);
  });

  it('祖先成员可见子孙 20，不可见 30', () => {
    const ids = filterDocsForDeptAcl(
      [...docs, { id: 'b30', ownerDeptId: DEPT_B, visibilityLevel: 30 }],
      {
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        enforce: true,
        depts: tree,
      },
    ).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'b20']);
  });

  it('祖先负责人可见子孙 30', () => {
    const ids = filterDocsForDeptAcl(
      [...docs, { id: 'b30', ownerDeptId: DEPT_B, visibilityLevel: 30 }],
      {
        assignments: [{ deptId: DEPT_A, isLeader: true }],
        enforce: true,
        depts: tree,
      },
    ).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'a30', 'b20', 'b30']);
  });

  it('下级不可见仅挂在上级的文档', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_B, isLeader: true }],
      enforce: true,
      depts: tree,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'b20']);
  });

  it('兄弟不可见', () => {
    const ids = filterDocsForDeptAcl(
      [...docs, { id: 'c20', ownerDeptId: DEPT_C, visibilityLevel: 20 }],
      {
        assignments: [{ deptId: DEPT_B, isLeader: true }],
        enforce: true,
        depts: tree,
      },
    ).map((d) => d.id);
    expect(ids).toEqual(['lib', 'b20']);
  });

  it('无 depts 时精确同部门仍可见', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: false }],
      enforce: true,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20']);
  });

  it('不传 depts 时祖先不可见（无 path）', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: true }],
      enforce: true,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'a30']);
    expect(ids).not.toContain('b20');
  });

  it('owner 不在树：不能走祖先，精确仍可见', () => {
    const noOwner = tree.filter((d) => d.id !== DEPT_B);
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [{ deptId: DEPT_A, isLeader: true }],
        true,
        noOwner,
      ),
    ).toBe(false);
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [{ deptId: DEPT_B, isLeader: false }],
        true,
        noOwner,
      ),
    ).toBe(true);
  });

  it('多命中取 max（祖先负责人盖过本部门成员）', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 30 },
        [
          { deptId: DEPT_B, isLeader: false },
          { deptId: DEPT_A, isLeader: true },
        ],
        true,
        tree,
      ),
    ).toBe(true);
  });

  it('祖先用例带空 grants 仍绿', () => {
    const ids = filterDocsForDeptAcl(
      [...docs, { id: 'b30', ownerDeptId: DEPT_B, visibilityLevel: 30 }],
      {
        assignments: [{ deptId: DEPT_A, isLeader: true }],
        enforce: true,
        depts: tree,
        grants: [],
      },
    ).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'a30', 'b20', 'b30']);
  });

  it('inherit false：祖先不可见子孙 20，精确同部门仍可见', () => {
    const ancestorIds = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: false }],
      enforce: true,
      depts: tree,
      inheritDown: false,
    }).map((d) => d.id);
    expect(ancestorIds).toEqual(['lib', 'a20']);
    expect(ancestorIds).not.toContain('b20');

    const exactIds = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_B, isLeader: false }],
      enforce: true,
      depts: tree,
      inheritDown: false,
    }).map((d) => d.id);
    expect(exactIds).toEqual(['lib', 'b20']);

    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [{ deptId: DEPT_A, isLeader: true }],
        true,
        tree,
        undefined,
        undefined,
        undefined,
        false,
      ),
    ).toBe(false);
  });

  it('inherit false 不关精确 grant', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_B, maxVisibilityLevel: 20, expiresAt: null }],
        undefined,
        undefined,
        false,
      ),
    ).toBe(true);
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [],
      enforce: true,
      depts: tree,
      grants: [{ deptId: DEPT_B, maxVisibilityLevel: 20, expiresAt: null }],
      inheritDown: false,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'b20']);
  });

  it('inherit 缺省/true：祖先仍可见子孙 20', () => {
    const omitted = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: false }],
      enforce: true,
      depts: tree,
    }).map((d) => d.id);
    const explicit = filterDocsForDeptAcl(docs, {
      assignments: [{ deptId: DEPT_A, isLeader: false }],
      enforce: true,
      depts: tree,
      inheritDown: true,
    }).map((d) => d.id);
    expect(omitted).toEqual(['lib', 'a20', 'b20']);
    expect(explicit).toEqual(['lib', 'a20', 'b20']);
  });

  it('env DEPT_INHERIT_DOWN=false 时谓词缺省也不走祖先', () => {
    const prev = process.env.DEPT_INHERIT_DOWN;
    process.env.DEPT_INHERIT_DOWN = 'false';
    try {
      expect(
        isDocVisibleForDeptAcl(
          { ownerDeptId: DEPT_B, visibilityLevel: 20 },
          [{ deptId: DEPT_A, isLeader: true }],
          true,
          tree,
        ),
      ).toBe(false);
      const ids = filterDocsForDeptAcl(docs, {
        assignments: [{ deptId: DEPT_A, isLeader: false }],
        enforce: true,
        depts: tree,
      }).map((d) => d.id);
      expect(ids).not.toContain('b20');
    } finally {
      if (prev === undefined) delete process.env.DEPT_INHERIT_DOWN;
      else process.env.DEPT_INHERIT_DOWN = prev;
    }
  });

  it('enforce 关时 inherit false 不影响（全可见）', () => {
    expect(
      filterDocsForDeptAcl(docs, {
        assignments: [],
        enforce: false,
        depts: tree,
        inheritDown: false,
      }).map((d) => d.id),
    ).toEqual(['lib', 'a20', 'a30', 'b20']);
  });
});

describe('isGrantActive', () => {
  const now = '2026-08-17 12:00:00';

  it('空 expiresAt → true', () => {
    expect(isGrantActive(null, now)).toBe(true);
    expect(isGrantActive(undefined, now)).toBe(true);
    expect(isGrantActive('', now)).toBe(true);
  });

  it('未过期 → true', () => {
    expect(isGrantActive('2026-08-17 12:00:01', now)).toBe(true);
  });

  it('过期 → false', () => {
    expect(isGrantActive('2026-08-17 12:00:00', now)).toBe(false);
    expect(isGrantActive('2026-08-17 11:59:59', now)).toBe(false);
  });
});

describe('dept acl grants', () => {
  it('未过期 grant≥级别 → 精确该部门可见（含 40）', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 40 },
        [],
        true,
        tree,
        [{ deptId: DEPT_B, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(true);
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [],
      enforce: true,
      grants: [{ deptId: DEPT_B, maxVisibilityLevel: 20, expiresAt: '2099-12-31 23:59:59' }],
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'b20']);
  });

  it('过期 grant → 不可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_B, maxVisibilityLevel: 40, expiresAt: '2000-01-01 00:00:00' }],
        '2026-08-17 12:00:00',
      ),
    ).toBe(false);
  });

  it('级别不够 → 不可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 30 },
        [],
        true,
        undefined,
        [{ deptId: DEPT_B, maxVisibilityLevel: 20, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('grant 在 A、文档在 A 的子部门 → 可见（级别够且有树）', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(true);
  });

  it('无树：grant 在 A、文档在 B → 只精确，不可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        undefined,
        [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('grant 在子孙、文档在祖先 → 不可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_A, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_B, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('grant 在兄弟部门 → 不可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_C, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_B, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('缺节点：owner 不在树 → grant 祖先不命中', () => {
    const noOwner = tree.filter((d) => d.id !== DEPT_B);
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        noOwner,
        [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('缺节点：grant 部门不在树 → 不猜子树', () => {
    const noGrantDept = tree.filter((d) => d.id !== DEPT_A);
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        noGrantDept,
        [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('过期祖先 grant → 子孙不可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: '2000-01-01 00:00:00' }],
        '2026-08-17 12:00:00',
      ),
    ).toBe(false);
  });

  it('inheritDown false + grant 在祖先 → 仍可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 20 },
        [],
        true,
        tree,
        [{ deptId: DEPT_A, maxVisibilityLevel: 20, expiresAt: null }],
        undefined,
        undefined,
        false,
      ),
    ).toBe(true);
  });

  it('filterDocs：inheritDown false + grant 祖先仍可见子孙', () => {
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [],
      enforce: true,
      depts: tree,
      grants: [{ deptId: DEPT_A, maxVisibilityLevel: 20, expiresAt: null }],
      inheritDown: false,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'b20']);
    expect(ids).not.toContain('a30');
  });

  it('grant 不作用于空部门文档', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: null, visibilityLevel: 40 },
        [],
        true,
        tree,
        [{ deptId: DEPT_A, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(false);
  });

  it('归属与 grant 取 max', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 40 },
        [{ deptId: DEPT_B, isLeader: true }],
        true,
        tree,
        [{ deptId: DEPT_B, maxVisibilityLevel: 40, expiresAt: null }],
      ),
    ).toBe(true);
  });

  it('bypass 开 → 他部门 level 40 可见', () => {
    expect(
      isDocVisibleForDeptAcl(
        { ownerDeptId: DEPT_B, visibilityLevel: 40 },
        [],
        true,
        tree,
        undefined,
        undefined,
        true,
      ),
    ).toBe(true);
    const ids = filterDocsForDeptAcl(docs, {
      assignments: [],
      enforce: true,
      bypass: true,
    }).map((d) => d.id);
    expect(ids).toEqual(['lib', 'a20', 'a30', 'b20']);
  });

  it('bypass 关 / 缺省 → 非超管仍拦', () => {
    expect(
      isDocVisibleForDeptAcl({ ownerDeptId: DEPT_B, visibilityLevel: 40 }, [], true, tree),
    ).toBe(false);
    expect(
      filterDocsForDeptAcl(docs, { assignments: [], enforce: true, bypass: false }).map(
        (d) => d.id,
      ),
    ).toEqual(['lib']);
  });

  it('enforce 关时 bypass 不影响', () => {
    expect(
      filterDocsForDeptAcl(docs, { assignments: [], enforce: false, bypass: true }).map(
        (d) => d.id,
      ),
    ).toEqual(['lib', 'a20', 'a30', 'b20']);
  });

  it('userId / tenantId 缺 → 无 grant，不抛', async () => {
    await expect(loadDeptGrants(undefined, undefined)).resolves.toEqual([]);
    await expect(loadDeptGrants('t1', undefined)).resolves.toEqual([]);
    await expect(loadDeptGrants(undefined, 'u1')).resolves.toEqual([]);
  });
});
