/**
 * 目标：sensitive 文档 complete 必须过密级闸。
 * 需求：P3b-SENS
 * 被测：parseDataClassFromConfig / isSensitiveCompleteBlocked
 * 简介：P3b-SENS dataClass / complete 闸。
 */

import { describe, expect, it } from 'vitest';

import {
  isSensitiveCompleteBlocked,
  parseDataClassFromConfig,
} from '../../src/services/kb-settings.js';

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

  it('sensitive + 关强制：显式名单就绪，null 仍挡', () => {
    const owner = '01900000-0000-7000-8000-0000000000de';
    const user = '01900000-0000-7000-8000-0000000000a1';
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: owner,
        deptAclEnforce: false,
        aclPrincipals: null,
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: null,
        deptAclEnforce: false,
        aclPrincipals: [],
      }),
    ).toBe(false);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: null,
        deptAclEnforce: false,
        aclPrincipals: [user],
      }),
    ).toBe(false);
  });

  it('sensitive + 开强制无 owner：名单仍可解禁；部门路径不依赖名单', () => {
    const owner = '01900000-0000-7000-8000-0000000000de';
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: null,
        deptAclEnforce: true,
        aclPrincipals: null,
      }),
    ).toBe(true);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: null,
        deptAclEnforce: true,
        aclPrincipals: [],
      }),
    ).toBe(false);
    expect(
      isSensitiveCompleteBlocked({
        dataClass: 'sensitive',
        ownerDeptId: owner,
        deptAclEnforce: true,
        aclPrincipals: null,
      }),
    ).toBe(false);
  });
});
