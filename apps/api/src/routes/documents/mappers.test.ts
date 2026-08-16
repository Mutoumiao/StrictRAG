import { describe, expect, it } from 'vitest';

import { toDetail, toListItem, type DocMapSource } from './mappers.js';

const base: DocMapSource = {
  id: '01900000-0000-7000-8000-0000000000d1',
  title: '示例文档',
  status: 'ready',
  approvalStatus: 'approved',
  lifecycle: 'active',
  byteSize: 128,
  indexVersion: 2,
  errorCode: null,
  embedReady: 1,
  esReady: 0,
  tenantId: '01900000-0000-7000-8000-000000000001',
  kbId: '01900000-0000-7000-8000-0000000000aa',
  sourceType: 'upload',
  contentType: 'text/plain',
  errorMessage: null,
  docType: 'policy',
  createdAt: '2026-08-01 10:00:00',
  updatedAt: '2026-08-02 11:00:00',
};

describe('documents mappers（ARCH-P1a 域内纯函数）', () => {
  it('toListItem 映射状态与就绪标志', () => {
    const item = toListItem(base);
    expect(item.id).toBe(base.id);
    expect(item.title).toBe('示例文档');
    expect(item.status).toBe('ready');
    expect(item.approvalStatus).toBe('approved');
    expect(item.lifecycle).toBe('active');
    expect(item.byteSize).toBe(128);
    expect(item.indexVersion).toBe(2);
    expect(item.errorCode).toBeNull();
    expect(item.embedReady).toBe(true);
    expect(item.esReady).toBe(false);
  });

  it('toDetail 含租户/KB 与元数据', () => {
    const detail = toDetail(base);
    expect(detail.tenantId).toBe(base.tenantId);
    expect(detail.kbId).toBe(base.kbId);
    expect(detail.sourceType).toBe('upload');
    expect(detail.contentType).toBe('text/plain');
    expect(detail.docType).toBe('policy');
    expect(detail.createdAt).toBe('2026-08-01 10:00:00');
    expect(detail.embedReady).toBe(true);
  });

  it('旧行缺部门字段 → ownerDeptId=null、visibilityLevel=20', () => {
    const detail = toDetail(base);
    expect(detail.ownerDeptId).toBeNull();
    expect(detail.visibilityLevel).toBe(20);
    expect(toListItem(base)).not.toHaveProperty('ownerDeptId');
    expect(toListItem(base)).not.toHaveProperty('visibilityLevel');
  });

  it('toDetail 回读已写部门字段', () => {
    const detail = toDetail({
      ...base,
      ownerDeptId: '01900000-0000-7000-8000-0000000000de',
      visibilityLevel: 30,
    });
    expect(detail.ownerDeptId).toBe('01900000-0000-7000-8000-0000000000de');
    expect(detail.visibilityLevel).toBe(30);
  });

  it('缺省可选字段 → null', () => {
    const sparse: DocMapSource = {
      ...base,
      byteSize: undefined,
      errorCode: undefined,
      contentType: undefined,
      errorMessage: undefined,
      docType: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      ownerDeptId: undefined,
      visibilityLevel: undefined,
    };
    const detail = toDetail(sparse);
    expect(detail.byteSize).toBeNull();
    expect(detail.errorCode).toBeNull();
    expect(detail.contentType).toBeNull();
    expect(detail.errorMessage).toBeNull();
    expect(detail.docType).toBeNull();
    expect(detail.createdAt).toBeNull();
    expect(detail.updatedAt).toBeNull();
    expect(detail.ownerDeptId).toBeNull();
    expect(detail.visibilityLevel).toBe(20);
  });
});
