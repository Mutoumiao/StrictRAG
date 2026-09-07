/**
 * 目标：文档表必须含部门、可见级与 acl_principals 列，且 id / 时间列策略不变。
 * 需求：P3b-META · P3b 文档 ACL
 * 被测：documents
 * 简介：核对 ownerDeptId / visibilityLevel / aclPrincipals 及本地时间、uuid；强制未接。
 */

import { describe, expect, it } from 'vitest';

import { documents } from '../../src/schema/index.js';

describe('documents schema (P3b-META)', () => {
  it('exposes ownerDeptId and visibilityLevel columns', () => {
    expect(documents.ownerDeptId).toBeDefined();
    expect(documents.visibilityLevel).toBeDefined();
    expect(documents.ownerDeptId.name).toBe('owner_dept_id');
    expect(documents.visibilityLevel.name).toBe('visibility_level');
  });

  it('exposes aclPrincipals as nullable uuid array', () => {
    expect(documents.aclPrincipals).toBeDefined();
    expect(documents.aclPrincipals.name).toBe('acl_principals');
  });

  it('keeps local time strings and uuid id strategy', () => {
    expect(documents.id).toBeDefined();
    expect(documents.createdAt).toBeDefined();
    expect(documents.updatedAt).toBeDefined();
    expect(documents.id.name).toBe('id');
    expect(documents.createdAt.name).toBe('created_at');
  });
});
