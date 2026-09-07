/**
 * 目标：文档级用户 uuid 名单必须按 null/[]/命中/未命中/bypass 过滤，失败则非名单用户可读。
 * 需求：P3b 文档 ACL · 覆盖 B2-4 / B2-1 最小
 * 被测：isDocVisibleForAclPrincipals / filterDocsForAclPrincipals
 * 简介：null 可见、[] 不可见、命中可见、未命中/无 userId 不可见、bypass 可见。
 */

import { describe, expect, it } from 'vitest';

import {
  filterDocsForAclPrincipals,
  isDocVisibleForAclPrincipals,
} from '../../src/services/retrieve/doc-acl.js';

const USER = '01900000-0000-7000-8000-0000000000e1';
const OTHER = '01900000-0000-7000-8000-0000000000e2';

describe('isDocVisibleForAclPrincipals', () => {
  it('bypass → 可见', () => {
    expect(isDocVisibleForAclPrincipals({ aclPrincipals: [] }, { bypass: true })).toBe(true);
    expect(
      isDocVisibleForAclPrincipals({ aclPrincipals: [OTHER] }, { userId: USER, bypass: true }),
    ).toBe(true);
  });

  it('null / 缺字段 → 可见', () => {
    expect(isDocVisibleForAclPrincipals({ aclPrincipals: null }, { userId: USER })).toBe(true);
    expect(isDocVisibleForAclPrincipals({}, { userId: USER })).toBe(true);
  });

  it('[] → 不可见', () => {
    expect(isDocVisibleForAclPrincipals({ aclPrincipals: [] }, { userId: USER })).toBe(false);
  });

  it('命中 userId → 可见', () => {
    expect(
      isDocVisibleForAclPrincipals({ aclPrincipals: [OTHER, USER] }, { userId: USER }),
    ).toBe(true);
  });

  it('未命中 → 不可见', () => {
    expect(isDocVisibleForAclPrincipals({ aclPrincipals: [OTHER] }, { userId: USER })).toBe(
      false,
    );
  });

  it('缺 userId 且非 bypass → 不可见', () => {
    expect(isDocVisibleForAclPrincipals({ aclPrincipals: [USER] }, {})).toBe(false);
    expect(isDocVisibleForAclPrincipals({ aclPrincipals: [USER] }, { userId: '' })).toBe(false);
  });
});

describe('filterDocsForAclPrincipals', () => {
  it('B2-1 最小：未授权文档不进过滤结果', () => {
    const docs = [
      { id: 'open', aclPrincipals: null as string[] | null },
      { id: 'empty', aclPrincipals: [] as string[] },
      { id: 'hit', aclPrincipals: [USER] },
      { id: 'miss', aclPrincipals: [OTHER] },
    ];
    expect(filterDocsForAclPrincipals(docs, { userId: USER }).map((d) => d.id)).toEqual([
      'open',
      'hit',
    ]);
  });

  it('bypass 原样', () => {
    const docs = [
      { id: 'empty', aclPrincipals: [] as string[] },
      { id: 'miss', aclPrincipals: [OTHER] },
    ];
    expect(
      filterDocsForAclPrincipals(docs, { userId: USER, bypass: true }).map((d) => d.id),
    ).toEqual(['empty', 'miss']);
  });
});
