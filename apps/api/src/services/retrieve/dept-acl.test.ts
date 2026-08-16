import { describe, expect, it } from 'vitest';

import {
  filterDocsForDeptAcl,
  isDocVisibleForDeptAcl,
  loadDeptAssignments,
} from './dept-acl.js';

const DEPT_A = '01900000-0000-7000-8000-0000000000a1';
const DEPT_B = '01900000-0000-7000-8000-0000000000b1';

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
});
