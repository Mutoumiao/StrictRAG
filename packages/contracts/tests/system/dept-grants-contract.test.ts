/**
 * 目标：跨部门 grant DTO 只接受合法可见级、uuid 与本地时间 expiresAt。
 * 需求：DEPT_ACL
 * 被测：CreateDeptCrossGrantBodySchema · ListDeptCrossGrantsQuerySchema
 * 简介：grant DTO 形状。
 */

import { describe, expect, it } from 'vitest';

import {
  CreateDeptCrossGrantBodySchema,
  ListDeptCrossGrantsQuerySchema,
} from '../../src/system/dept-grants.contract.js';

const userId = '01900000-0000-7000-8000-0000000000aa';
const deptId = '01900000-0000-7000-8000-0000000000bb';

describe('dept-grants.contract', () => {
  it('CreateDeptCrossGrantBody accepts legal level + uuids', () => {
    const r = CreateDeptCrossGrantBodySchema.safeParse({
      userId,
      deptId,
      maxVisibilityLevel: 20,
      expiresAt: null,
      reason: 'cross-team',
    });
    expect(r.success).toBe(true);
  });

  it('CreateDeptCrossGrantBody rejects unknown field (strict)', () => {
    const r = CreateDeptCrossGrantBodySchema.safeParse({
      userId,
      deptId,
      maxVisibilityLevel: 20,
      extra: true,
    });
    expect(r.success).toBe(false);
  });

  it('CreateDeptCrossGrantBody rejects illegal level', () => {
    expect(
      CreateDeptCrossGrantBodySchema.safeParse({
        userId,
        deptId,
        maxVisibilityLevel: 15,
      }).success,
    ).toBe(false);
    expect(
      CreateDeptCrossGrantBodySchema.safeParse({
        userId,
        deptId,
        maxVisibilityLevel: 41,
      }).success,
    ).toBe(false);
  });

  it('CreateDeptCrossGrantBody rejects non-local expiresAt', () => {
    expect(
      CreateDeptCrossGrantBodySchema.safeParse({
        userId,
        deptId,
        maxVisibilityLevel: 20,
        expiresAt: 'tomorrow',
      }).success,
    ).toBe(false);
    expect(
      CreateDeptCrossGrantBodySchema.safeParse({
        userId,
        deptId,
        maxVisibilityLevel: 20,
        expiresAt: '2026-12-31 23:59:59',
      }).success,
    ).toBe(true);
  });

  it('CreateDeptCrossGrantBody rejects non-uuid', () => {
    expect(
      CreateDeptCrossGrantBodySchema.safeParse({
        userId: 'not-a-uuid',
        deptId,
        maxVisibilityLevel: 20,
      }).success,
    ).toBe(false);
  });

  it('ListDeptCrossGrantsQuery accepts empty / uuid filters', () => {
    expect(ListDeptCrossGrantsQuerySchema.safeParse({}).success).toBe(true);
    expect(ListDeptCrossGrantsQuerySchema.safeParse({ userId }).success).toBe(true);
    expect(ListDeptCrossGrantsQuerySchema.safeParse({ deptId }).success).toBe(true);
  });

  it('ListDeptCrossGrantsQuery rejects non-uuid filter', () => {
    expect(ListDeptCrossGrantsQuerySchema.safeParse({ userId: 'x' }).success).toBe(false);
  });
});
