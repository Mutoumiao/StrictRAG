/**
 * 目标：有效权限码 = 模板 ∪ grants − denies。
 * 需求：ADR-051
 * 被测：resolveEffectiveCodes / canAccessKbScoped
 * 简介：有效码求值。
 */

import { describe, expect, it } from 'vitest';

import {
  canAccessKbScoped,
  canEnterAdminShell,
  hasPermission,
  resolveEffectiveCodes,
} from '../../src/auth/permissions/resolve.js';

describe('resolveEffectiveCodes', () => {
  it('super_admin gets all codes including admin.shell', () => {
    const codes = resolveEffectiveCodes({ roleCodes: ['super_admin'] });
    expect(canEnterAdminShell(codes)).toBe(true);
    expect(hasPermission(codes, 'approval.decide')).toBe(true);
    expect(hasPermission(codes, 'role.perm.manage')).toBe(true);
  });

  it('doc_operator cannot decide approval', () => {
    const codes = resolveEffectiveCodes({ roleCodes: ['doc_operator'] });
    expect(canEnterAdminShell(codes)).toBe(true);
    expect(hasPermission(codes, 'doc.upload')).toBe(true);
    expect(hasPermission(codes, 'approval.decide')).toBe(false);
  });

  it('web_consumer has no admin.shell', () => {
    const codes = resolveEffectiveCodes({ roleCodes: ['web_consumer'] });
    expect(canEnterAdminShell(codes)).toBe(false);
    expect(codes.size).toBe(0);
  });

  it('union of multiple roles', () => {
    const codes = resolveEffectiveCodes({
      roleCodes: ['doc_operator'],
      extraGrants: ['approval.decide'],
    });
    expect(hasPermission(codes, 'approval.decide')).toBe(true);
  });

  it('deny removes code', () => {
    const codes = resolveEffectiveCodes({
      roleCodes: ['kb_admin'],
      extraDenies: ['eval.run'],
    });
    expect(hasPermission(codes, 'eval.run')).toBe(false);
  });
});

describe('canAccessKbScoped', () => {
  it('super_admin bypasses kb membership', () => {
    const roles = ['super_admin'];
    const effective = resolveEffectiveCodes({ roleCodes: roles });
    expect(
      canAccessKbScoped({
        roleCodes: roles,
        effective,
        requiredCode: 'doc.view',
        isKbMember: false,
      }),
    ).toBe(true);
  });

  it('non-super requires membership for kb codes', () => {
    const roles = ['kb_admin'];
    const effective = resolveEffectiveCodes({ roleCodes: roles });
    expect(
      canAccessKbScoped({
        roleCodes: roles,
        effective,
        requiredCode: 'doc.view',
        isKbMember: false,
      }),
    ).toBe(false);
    expect(
      canAccessKbScoped({
        roleCodes: roles,
        effective,
        requiredCode: 'doc.view',
        isKbMember: true,
      }),
    ).toBe(true);
  });

  it('platform codes ignore membership', () => {
    const roles = ['kb_admin'];
    const effective = resolveEffectiveCodes({ roleCodes: roles });
    expect(
      canAccessKbScoped({
        roleCodes: roles,
        effective,
        requiredCode: 'admin.shell',
        isKbMember: false,
      }),
    ).toBe(true);
  });
});
