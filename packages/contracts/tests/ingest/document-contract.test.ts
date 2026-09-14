/**
 * 目标：文档 / 知识库 DTO 与完成上传、补丁元数据必须接受合法部门可见级并拒非法值。
 * 需求：入库 HTTP
 * 被测：CreateKbBodySchema · KnowledgeBaseListItemSchema · VisibilityLevelSchema · CompleteUploadBodySchema · WriteDocumentBodySchema · WriteDocumentResponseSchema · PatchDocumentMetaBodySchema · DocumentDetailSchema · DocumentListItemSchema · ReindexDocumentResponseSchema · SupersedeDocumentBodySchema · SupersedeDocumentResponseSchema · DeleteDocumentResponseSchema
 * 简介：文档 DTO 与可见级 / 部门字段 / aclPrincipals 三态 / 生效区间 / 替代边；reindex stage 可 chunk 或 ocr；DELETE 响应 archived + purgeEnqueued。
 */

import { describe, expect, it } from 'vitest';

import {
  CompleteUploadBodySchema,
  CreateKbBodySchema,
  WriteDocumentBodySchema,
  WriteDocumentResponseSchema,
  DocumentDetailSchema,
  DocumentListItemSchema,
  KnowledgeBaseListItemSchema,
  PatchDocumentMetaBodySchema,
  ReindexDocumentResponseSchema,
  DeleteDocumentResponseSchema,
  SupersedeDocumentBodySchema,
  SupersedeDocumentResponseSchema,
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

  it('accepts aclPrincipals omit / null / empty / uuid list', () => {
    expect(CompleteUploadBodySchema.safeParse({}).success).toBe(true);
    expect(CompleteUploadBodySchema.safeParse({ aclPrincipals: null }).success).toBe(true);
    expect(CompleteUploadBodySchema.safeParse({ aclPrincipals: [] }).success).toBe(true);
    expect(
      CompleteUploadBodySchema.safeParse({
        aclPrincipals: ['01900000-0000-7000-8000-0000000000a1'],
      }).success,
    ).toBe(true);
  });

  it('rejects invalid or overlong aclPrincipals', () => {
    expect(CompleteUploadBodySchema.safeParse({ aclPrincipals: ['not-a-uuid'] }).success).toBe(
      false,
    );
    expect(
      CompleteUploadBodySchema.safeParse({
        aclPrincipals: Array.from({ length: 257 }, () => '01900000-0000-7000-8000-0000000000a1'),
      }).success,
    ).toBe(false);
  });

  it('accepts optional 64-hex checksumSha256 and rejects short values', () => {
    const checksumSha256 = 'a'.repeat(64);
    expect(CompleteUploadBodySchema.safeParse({ checksumSha256 }).success).toBe(true);
    expect(CompleteUploadBodySchema.safeParse({ checksumSha256: 'abc' }).success).toBe(false);
  });
});


describe('WriteDocumentBodySchema', () => {
  it('接受标题与 markdown', () => {
    expect(
      WriteDocumentBodySchema.safeParse({ title: '差旅', markdown: '# 正文' }).success,
    ).toBe(true);
  });

  it('拒空 markdown 或空标题', () => {
    expect(WriteDocumentBodySchema.safeParse({ title: '差旅', markdown: '' }).success).toBe(false);
    expect(WriteDocumentBodySchema.safeParse({ title: '', markdown: '# 正文' }).success).toBe(
      false,
    );
    expect(WriteDocumentBodySchema.safeParse({ title: '差旅', markdown: '  \n' }).success).toBe(
      false,
    );
    expect(WriteDocumentBodySchema.safeParse({ markdown: '# 正文' }).success).toBe(false);
  });
});

describe('WriteDocumentResponseSchema', () => {
  it('必须 sourceType=write', () => {
    const base = {
      docId: '01900000-0000-7000-8000-0000000000d1',
      byteSize: 12,
      approvalStatus: 'pending' as const,
      status: 'uploaded' as const,
      chunkStrategy: 'structure_paragraph',
    };
    expect(WriteDocumentResponseSchema.safeParse({ ...base, sourceType: 'write' }).success).toBe(
      true,
    );
    expect(WriteDocumentResponseSchema.safeParse({ ...base, sourceType: 'upload' }).success).toBe(
      false,
    );
    expect(WriteDocumentResponseSchema.safeParse(base).success).toBe(false);
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

  it('accepts docType string or null', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({ docType: 'hr' }).success).toBe(true);
    expect(PatchDocumentMetaBodySchema.safeParse({ docType: null }).success).toBe(true);
  });

  it('rejects empty docType string', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({ docType: '' }).success).toBe(false);
  });

  it('accepts effectiveFrom/effectiveTo local datetime or null', () => {
    expect(
      PatchDocumentMetaBodySchema.safeParse({ effectiveFrom: '2026-09-01 00:00:00' }).success,
    ).toBe(true);
    expect(PatchDocumentMetaBodySchema.safeParse({ effectiveTo: null }).success).toBe(true);
  });

  it('rejects ISO effectiveFrom', () => {
    expect(
      PatchDocumentMetaBodySchema.safeParse({ effectiveFrom: '2026-09-01T00:00:00Z' }).success,
    ).toBe(false);
  });

  it('aclPrincipals: omit 其它字段仍成功；null / [] / uuid 列表成功', () => {
    expect(PatchDocumentMetaBodySchema.safeParse({ ownerDeptId: null }).success).toBe(true);
    expect(PatchDocumentMetaBodySchema.safeParse({ aclPrincipals: null }).success).toBe(true);
    expect(PatchDocumentMetaBodySchema.safeParse({ aclPrincipals: [] }).success).toBe(true);
    expect(
      PatchDocumentMetaBodySchema.safeParse({
        aclPrincipals: ['01900000-0000-7000-8000-0000000000e1'],
      }).success,
    ).toBe(true);
  });

  it('aclPrincipals 非法 uuid / 超长 257 / 空对象失败', () => {
    expect(
      PatchDocumentMetaBodySchema.safeParse({ aclPrincipals: ['not-a-uuid'] }).success,
    ).toBe(false);
    expect(
      PatchDocumentMetaBodySchema.safeParse({
        aclPrincipals: Array.from({ length: 257 }, () => '01900000-0000-7000-8000-0000000000e1'),
      }).success,
    ).toBe(false);
    expect(PatchDocumentMetaBodySchema.safeParse({}).success).toBe(false);
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

  it('list item schema has ownerDeptId / visibilityLevel / aclPrincipals', () => {
    const keys = Object.keys(DocumentListItemSchema.shape);
    expect(keys).toContain('ownerDeptId');
    expect(keys).toContain('visibilityLevel');
    expect(keys).toContain('docType');
    expect(keys).toContain('aclPrincipals');
    expect(keys).toContain('supersedesDocId');
    expect(keys).toContain('supersededByDocId');
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
    expect(parsed.aclPrincipals).toBeNull();
    expect(parsed.supersedesDocId).toBeNull();
    expect(parsed.supersededByDocId).toBeNull();
  });
});

describe('SupersedeDocumentBodySchema / response', () => {
  const oldDocId = '01900000-0000-7000-8000-0000000000d1';
  const successorDocId = '01900000-0000-7000-8000-0000000000d2';

  it('接受合法 successorDocId', () => {
    expect(SupersedeDocumentBodySchema.safeParse({ successorDocId }).success).toBe(true);
  });

  it('缺后继或非法 uuid 拒', () => {
    expect(SupersedeDocumentBodySchema.safeParse({}).success).toBe(false);
    expect(SupersedeDocumentBodySchema.safeParse({ successorDocId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('响应含两列与两态', () => {
    expect(
      SupersedeDocumentResponseSchema.safeParse({
        oldDocId,
        successorDocId,
        oldLifecycle: 'superseded',
        successorLifecycle: 'active',
      }).success,
    ).toBe(true);
    expect(
      SupersedeDocumentResponseSchema.safeParse({
        oldDocId,
        successorDocId,
        oldLifecycle: 'draft',
        successorLifecycle: 'active',
      }).success,
    ).toBe(false);
  });
});

describe('DeleteDocumentResponseSchema', () => {
  const docId = '01900000-0000-7000-8000-0000000000d1';

  it('响应含 archived 与 purgeEnqueued', () => {
    expect(
      DeleteDocumentResponseSchema.safeParse({
        docId,
        lifecycle: 'archived',
        purgeEnqueued: true,
      }).success,
    ).toBe(true);
  });

  it('非 archived 或未入队拒', () => {
    expect(
      DeleteDocumentResponseSchema.safeParse({
        docId,
        lifecycle: 'draft',
        purgeEnqueued: true,
      }).success,
    ).toBe(false);
    expect(
      DeleteDocumentResponseSchema.safeParse({
        docId,
        lifecycle: 'archived',
        purgeEnqueued: false,
      }).success,
    ).toBe(false);
  });
});


describe('ReindexDocumentResponseSchema', () => {
  const base = {
    docId: '01900000-0000-7000-8000-0000000000d1',
    enqueued: true as const,
    jobId: 'job-1',
    chunkStrategy: 'structure_paragraph',
    strategyChanged: false,
  };

  it('接受 stage=chunk 与 stage=ocr', () => {
    expect(ReindexDocumentResponseSchema.safeParse({ ...base, stage: 'chunk' }).success).toBe(
      true,
    );
    expect(ReindexDocumentResponseSchema.safeParse({ ...base, stage: 'ocr' }).success).toBe(true);
  });

  it('拒绝 scan 等非 reindex 入队 stage', () => {
    expect(ReindexDocumentResponseSchema.safeParse({ ...base, stage: 'scan' }).success).toBe(
      false,
    );
  });
});
