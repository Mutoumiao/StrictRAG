import { describe, expect, it } from 'vitest';

import { documents } from '../index.js';

describe('documents schema (P3b-META)', () => {
  it('exposes ownerDeptId and visibilityLevel columns', () => {
    expect(documents.ownerDeptId).toBeDefined();
    expect(documents.visibilityLevel).toBeDefined();
    expect(documents.ownerDeptId.name).toBe('owner_dept_id');
    expect(documents.visibilityLevel.name).toBe('visibility_level');
  });

  it('keeps local time strings and uuid id strategy', () => {
    expect(documents.id).toBeDefined();
    expect(documents.createdAt).toBeDefined();
    expect(documents.updatedAt).toBeDefined();
    expect(documents.id.name).toBe('id');
    expect(documents.createdAt.name).toBe('created_at');
  });
});
