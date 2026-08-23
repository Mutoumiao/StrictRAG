/**
 * 目标：平台用户角色 DTO 拒 password、角色码须 snake_case、补丁非空。
 * 需求：B4
 * 被测：CreatePlatformUserBodySchema · PatchPlatformUserBodySchema · CreatePlatformRoleBodySchema · AssignUserRolesBodySchema · PutRolePermissionsBodySchema
 * 简介：平台用户角色 DTO。
 */

import { describe, expect, it } from 'vitest';

import {
  AssignUserRolesBodySchema,
  CreatePlatformRoleBodySchema,
  CreatePlatformUserBodySchema,
  PatchPlatformUserBodySchema,
  PutRolePermissionsBodySchema,
} from '../../src/system/platform-users-roles.contract.js';

describe('platform users/roles contracts (B4)', () => {
  it('CreatePlatformUserBody accepts email + optional roles', () => {
    const r = CreatePlatformUserBodySchema.safeParse({
      email: 'ops@example.com',
      displayName: 'Ops',
      roleIds: ['01900000-0000-7000-8000-0000000000aa'],
    });
    expect(r.success).toBe(true);
  });

  it('CreatePlatformUserBody rejects password field (strict)', () => {
    const r = CreatePlatformUserBodySchema.safeParse({
      email: 'ops@example.com',
      password: 'secret',
    });
    expect(r.success).toBe(false);
  });

  it('PatchPlatformUserBody requires at least one field', () => {
    expect(PatchPlatformUserBodySchema.safeParse({}).success).toBe(false);
    expect(PatchPlatformUserBodySchema.safeParse({ status: 'disabled' }).success).toBe(true);
  });

  it('CreatePlatformRoleBody enforces snake_case code', () => {
    expect(
      CreatePlatformRoleBodySchema.safeParse({ code: 'CustomRole', name: 'x' }).success,
    ).toBe(false);
    expect(
      CreatePlatformRoleBodySchema.safeParse({
        code: 'custom_ops',
        name: '自定义运营',
        codes: ['admin.shell'],
      }).success,
    ).toBe(true);
  });

  it('AssignUserRolesBody + PutRolePermissionsBody parse', () => {
    expect(AssignUserRolesBodySchema.safeParse({ roleIds: [] }).success).toBe(true);
    expect(PutRolePermissionsBodySchema.safeParse({ codes: ['user.manage'] }).success).toBe(true);
  });
});
