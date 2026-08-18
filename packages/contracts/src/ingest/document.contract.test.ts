import { describe, expect, it } from 'vitest';

import {
  CompleteUploadBodySchema,
  DocumentDetailSchema,
  DocumentListItemSchema,
  PatchDocumentMetaBodySchema,
  VisibilityLevelSchema,
} from './document.contract.js';

const DETAIL_BASE = {
  id: '01900000-0000-7000-8000-0000000000d1',
  title: '示例',
  status: 'ready' as const,
  approvalStatus: 'approved' as const,
  lifecycle: 'active' as const,
  byteSize: 12,
  indexVersion: 1,
  errorCode: null,
  embedReady: true,
  esReady: true,
  tenantId: '01900000-0000-7000-8000-000000000001',
  kbId: '01900000-0000-7000-8000-0000000000aa',
};

describe('VisibilityLevelSchema', () => {
  it.each([10, 20, 30, 40] as const)('accepts %s', (level) => {
    expect(VisibilityLevelSchema.safeParse(level).success).toBe(true);
  });

  it.each([41, 15, 0, 50, '20'])('rejects %s', (level) => {
    expect(VisibilityLevelSchema.safeParse(level).success).toBe(false);
  });
});

describe('CompleteUploadBodySchema', () => {
  it('accepts empty / legacy body', () => {
    expect(CompleteUploadBodySchema.safeParse({}).success).toBe(true);
    expect(CompleteUploadBodySchema.safeParse({ declaredByteSize: 12 }).success).toBe(true);
    expect(
      CompleteUploadBodySchema.safeParse({ chunkStrategy: 'structure_paragraph' }).success,
    ).toBe(true);
  });

  it('accepts ownerDeptId uuid or null', () => {
    expect(
      CompleteUploadBodySchema.safeParse({
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
      }).success,
    ).toBe(true);
    expect(CompleteUploadBodySchema.safeParse({ ownerDeptId: null }).success).toBe(true);
  });

  it('accepts visibilityLevel 10/20/30/40', () => {
    expect(CompleteUploadBodySchema.safeParse({ visibilityLevel: 10 }).success).toBe(true);
    expect(CompleteUploadBodySchema.safeParse({ visibilityLevel: 40 }).success).toBe(true);
  });

  it('rejects invalid ownerDeptId / visibilityLevel', () => {
    expect(CompleteUploadBodySchema.safeParse({ ownerDeptId: 'not-a-uuid' }).success).toBe(false);
    expect(CompleteUploadBodySchema.safeParse({ ownerDeptId: 'hr' }).success).toBe(false);
    expect(CompleteUploadBodySchema.safeParse({ visibilityLevel: 41 }).success).toBe(false);
    expect(CompleteUploadBodySchema.safeParse({ visibilityLevel: 15 }).success).toBe(false);
  });
});

describe('PatchDocumentMetaBodySchema', () => {
  it('accepts ownerDeptId uuid or null', () => {
    expect(
      PatchDocumentMetaBodySchema.safeParse({
        ownerDeptId: '01900000-0000-7000-8000-0000000000de',
      }).success,
    ).toBe(true);
    expect(PatchDocumentMetaBodySchema.safeParse({ ownerDeptId: null }).success).toBe(true);
  });

  it('accepts visibilityLevel 10/20/30/40', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({ visibilityLevel: 10 }).success).toBe(true);
    expect(PatchDocumentMetaBodySchema.safeParse({ visibilityLevel: 40 }).success).toBe(true);
  });

  it('rejects empty body', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects visibilityLevel 41 / 15', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({ visibilityLevel: 41 }).success).toBe(false);
    expect(PatchDocumentMetaBodySchema.safeParse({ visibilityLevel: 15 }).success).toBe(false);
  });

  it('rejects non-uuid ownerDeptId', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({ ownerDeptId: 'not-a-uuid' }).success).toBe(
      false,
    );
    expect(PatchDocumentMetaBodySchema.safeParse({ ownerDeptId: 'hr' }).success).toBe(false);
  });
});

describe('DocumentDetailSchema / list item', () => {
  it('detail accepts optional dept meta', () => {
    expect(DocumentDetailSchema.safeParse(DETAIL_BASE).success).toBe(true);
    expect(
      DocumentDetailSchema.safeParse({
        ...DETAIL_BASE,
        ownerDeptId: null,
        visibilityLevel: 20,
      }).success,
    ).toBe(true);
  });

  it('list item schema has no ownerDeptId / visibilityLevel', () => {
    const keys = Object.keys(DocumentListItemSchema.shape);
    expect(keys).not.toContain('ownerDeptId');
    expect(keys).not.toContain('visibilityLevel');
  });
});
