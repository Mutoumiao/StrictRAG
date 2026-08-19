import type {
  ApprovalStatus,
  DocumentDetail,
  DocumentListItem,
  DocumentStatus,
  Lifecycle,
  VisibilityLevel,
} from '@strict-rag/contracts';

/** 列表/详情映射所需的最小文档行形状（与 documentRepo 行字段对齐，不绑 repo 实现） */
export type DocMapSource = {
  id: string;
  title: string;
  status: string;
  approvalStatus: string;
  lifecycle: string;
  byteSize?: number | null;
  indexVersion: number;
  errorCode?: string | null;
  embedReady: number;
  esReady: number;
  tenantId: string;
  kbId: string;
  sourceType: string;
  contentType?: string | null;
  errorMessage?: string | null;
  docType?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  ownerDeptId?: string | null;
  visibilityLevel?: number | null;
};

export function toListItem(r: DocMapSource): DocumentListItem {
  return {
    id: r.id,
    title: r.title,
    status: r.status as DocumentStatus,
    approvalStatus: r.approvalStatus as ApprovalStatus,
    lifecycle: r.lifecycle as Lifecycle,
    byteSize: r.byteSize ?? null,
    indexVersion: r.indexVersion,
    errorCode: r.errorCode ?? null,
    embedReady: r.embedReady === 1,
    esReady: r.esReady === 1,
    ownerDeptId: r.ownerDeptId ?? null,
    visibilityLevel: (r.visibilityLevel ?? 20) as VisibilityLevel,
  };
}

export function toDetail(r: DocMapSource): DocumentDetail {
  return {
    ...toListItem(r),
    tenantId: r.tenantId,
    kbId: r.kbId,
    sourceType: r.sourceType,
    contentType: r.contentType ?? null,
    errorMessage: r.errorMessage ?? null,
    docType: r.docType ?? null,
    createdAt: r.createdAt ?? null,
    updatedAt: r.updatedAt ?? null,
  };
}
