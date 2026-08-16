import { describe, expect, it } from 'vitest';

import { deptCrossGrants } from '../index.js';

describe('dept_cross_grants schema (P3b-GRANT)', () => {
  it('exposes grant columns and unique user+dept index', () => {
    expect(deptCrossGrants.userId.name).toBe('user_id');
    expect(deptCrossGrants.deptId.name).toBe('dept_id');
    expect(deptCrossGrants.maxVisibilityLevel.name).toBe('max_visibility_level');
    expect(deptCrossGrants.expiresAt.name).toBe('expires_at');
    expect(deptCrossGrants.reason.name).toBe('reason');
    expect(deptCrossGrants.grantedBy.name).toBe('granted_by');
    expect(deptCrossGrants.createdAt.name).toBe('created_at');
    expect(deptCrossGrants.id.name).toBe('id');
  });
});
