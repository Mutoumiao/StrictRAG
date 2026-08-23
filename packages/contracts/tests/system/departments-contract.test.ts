/**
 * 目标：部门创建 / 补丁 / 用户部门绑定 DTO 必须严格字段且补丁非空。
 * 需求：B5
 * 被测：CreateDepartmentBodySchema · PatchDepartmentBodySchema · PutUserDepartmentsBodySchema
 * 简介：部门 DTO 形状。
 */

import { describe, expect, it } from 'vitest';

import {
  CreateDepartmentBodySchema,
  PatchDepartmentBodySchema,
  PutUserDepartmentsBodySchema,
} from '../../src/system/departments.contract.js';

describe('departments.contract', () => {
  it('CreateDepartmentBody accepts name + optional parent', () => {
    const r = CreateDepartmentBodySchema.safeParse({
      name: '人事',
      parentId: null,
      code: 'hr',
    });
    expect(r.success).toBe(true);
  });

  it('CreateDepartmentBody rejects unknown field (strict)', () => {
    const r = CreateDepartmentBodySchema.safeParse({
      name: '人事',
      ownerDeptId: 'x',
    });
    expect(r.success).toBe(false);
  });

  it('PatchDepartmentBody requires at least one field', () => {
    expect(PatchDepartmentBodySchema.safeParse({}).success).toBe(false);
    expect(PatchDepartmentBodySchema.safeParse({ status: 'disabled' }).success).toBe(true);
  });

  it('PutUserDepartmentsBody accepts empty assignments (clear)', () => {
    const r = PutUserDepartmentsBodySchema.safeParse({ assignments: [] });
    expect(r.success).toBe(true);
  });

  it('PutUserDepartmentsBody defaults isLeader false', () => {
    const r = PutUserDepartmentsBodySchema.safeParse({
      assignments: [{ deptId: '01900000-0000-7000-8000-000000000001', isPrimary: true }],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.assignments[0]?.isLeader).toBe(false);
    }
  });
});
