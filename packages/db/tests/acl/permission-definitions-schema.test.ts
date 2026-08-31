/**
 * 目标：permission_definitions 必须按 catalog 字典列暴露，且 kind 不被 PRD 二分枚举收窄。
 * 需求：prds/03-data/01-postgresql-schema.md · ADR-056
 * 被测：permissionDefinitions
 * 简介：code PK + kind/scope/description/source；无运行时求值列。
 */

import { describe, expect, it } from 'vitest';

import { permissionDefinitions } from '../../src/schema/index.js';

describe('permissionDefinitions schema', () => {
  it('exposes catalog dictionary columns with code PK', () => {
    expect(permissionDefinitions.code.name).toBe('code');
    expect(permissionDefinitions.kind.name).toBe('kind');
    expect(permissionDefinitions.scope.name).toBe('scope');
    expect(permissionDefinitions.description.name).toBe('description');
    expect(permissionDefinitions.source.name).toBe('source');
  });

  it('does not add runtime evaluation columns', () => {
    const keys = Object.keys(permissionDefinitions);
    expect(keys.some((k) => /codesJson|codes_json/i.test(k))).toBe(false);
    expect(keys.some((k) => /role/i.test(k))).toBe(false);
  });
});
