/**
 * 目标：文档 / 知识库 DTO 与完成上传、补丁元数据必须接受合法部门可见级并拒非法值。
 * 需求：入库 HTTP
 * 被测：CreateKbBodySchema · KnowledgeBaseListItemSchema · VisibilityLevelSchema · CompleteUploadBodySchema · PatchDocumentMetaBodySchema · DocumentDetailSchema · DocumentListItemSchema
 * 简介：文档 DTO 与可见级 / 部门字段。
 */

import { describe, expect, it } from 'vitest';

import {
  CompleteUploadBodySchema,
  CreateKbBodySchema,
  DocumentDetailSchema,
  DocumentListItemSchema,
  KnowledgeBaseListItemSchema,
  PatchDocumentMetaBodySchema,
  VisibilityLevelSchema,
} from '../../src/ingest/document.contract.js';

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

describe('CreateKbBodySchema', () => {
  const adminUser = '01900000-0000-7000-8000-0000000000a1';

  it('接受名称 + 首位库管，丢掉 body tenantId', () => {
    const parsed = CreateKbBodySchema.safeParse({
      tenantId: '01900000-0000-7000-8000-000000000001',
      name: '演示库',
      initialAdminUserId: adminUser,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data).toEqual({ name: '演示库', initialAdminUserId: adminUser });
    }
  });

  it('缺 initialAdminUserId 或名称则失败', () => {
    expect(CreateKbBodySchema.safeParse({ name: '演示库' }).success).toBe(false);
    expect(CreateKbBodySchema.safeParse({ initialAdminUserId: adminUser }).success).toBe(false);
    expect(
      CreateKbBodySchema.safeParse({ name: '演示库', initialAdminUserId: 'not-uuid' }).success,
    ).toBe(false);
  });
});

describe('KnowledgeBaseListItemSchema', () => {
  it('accepts uuid list item with nullable description', () => {
    expect(
      KnowledgeBaseListItemSchema.safeParse({
        id: '01900000-0000-7000-8000-0000000000aa',
        tenantId: '01900000-0000-7000-8000-000000000001',
        name: '演示库',
        description: null,
      }).success,
    ).toBe(true);
  });

  it('rejects non-uuid id', () => {
    expect(
      KnowledgeBaseListItemSchema.safeParse({
        id: 'kb-1',
        tenantId: '01900000-0000-7000-8000-000000000001',
        name: 'x',
      }).success,
    ).toBe(false);
  });
});

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

  it('list item schema has ownerDeptId / visibilityLevel', () => {
    const keys = Object.keys(DocumentListItemSchema.shape);
    expect(keys).toContain('ownerDeptId');
    expect(keys).toContain('visibilityLevel');
    const parsed = DocumentListItemSchema.parse({
      id: DETAIL_BASE.id,
      title: DETAIL_BASE.title,
      status: DETAIL_BASE.status,
      approvalStatus: DETAIL_BASE.approvalStatus,
      lifecycle: DETAIL_BASE.lifecycle,
      byteSize: DETAIL_BASE.byteSize,
      indexVersion: DETAIL_BASE.indexVersion,
      errorCode: DETAIL_BASE.errorCode,
      embedReady: DETAIL_BASE.embedReady,
      esReady: DETAIL_BASE.esReady,
    });
    expect(parsed.ownerDeptId).toBeNull();
    expect(parsed.visibilityLevel).toBe(20);
  });
});
