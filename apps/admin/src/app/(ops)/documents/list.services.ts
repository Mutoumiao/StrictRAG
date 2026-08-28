'use client';

/**
 * 文档列表用例：调 api、错误映射。
 * 无 path；不做权限决策（UI 裁剪 + API 硬验）。
 */

import type { DocumentListItem, VisibilityLevel } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { listDocuments } from './api';

export type LoadDocumentListResult =
  | { ok: true; rows: DocumentListItem[] }
  | { ok: false; message: string };

export async function loadDocumentList(kbId: string): Promise<LoadDocumentListResult> {
  try {
    const rows = await listDocuments(kbId);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

/** 列表部门列：库级 —；选项命中显示名；否则 uuid。不写 URL。 */
export function deptLabel(
  id: string | null | undefined,
  options: { id: string; name: string }[] | null,
): string {
  if (id == null) return '—';
  const hit = options?.find((d) => d.id === id);
  return hit ? hit.name : String(id);
}

const VISIBILITY_LABELS: Record<VisibilityLevel, string> = {
  10: '10 部门全员',
  20: '20 部门成员',
  30: '30 负责人',
  40: '40 受限',
};

/** 文档页可见级展示：默认档中文；未知数字回退原值。不写 URL。 */
export function visibilityLabel(level: number): string {
  return VISIBILITY_LABELS[level as VisibilityLevel] ?? String(level);
}

/** 列表向量/稀疏列：true 就绪；false 未就绪。不写 URL。≠ 生产 ES。 */
export function readyColLabel(ready: boolean): string {
  return ready ? '就绪' : '未就绪';
}

const PIPELINE_STATUS = new Set([
  'scanning',
  'parsing',
  'chunking',
  'embedding',
  'indexing_es',
]);

export type OpsLabel =
  | '待审'
  | '处理中'
  | '需 OCR'
  | '失败'
  | '就绪未发布'
  | '现行可问'
  | '已替代'
  | '已归档';

/**
 * 双轴运营标签：lifecycle 终态优先，再 status，再审批。
 * 原串 status / lifecycle 另作次要信息，禁止合成一个模糊「状态」。
 */
export function opsLabel(
  status: string,
  lifecycle: string,
  approvalStatus?: string,
): OpsLabel {
  if (lifecycle === 'archived') return '已归档';
  if (lifecycle === 'superseded') return '已替代';
  if (status === 'failed') return '失败';
  if (status === 'needs_ocr') return '需 OCR';
  if (status === 'ready' && lifecycle === 'active') return '现行可问';
  if (status === 'ready') return '就绪未发布';
  if (status === 'needs_review' || approvalStatus === 'pending') return '待审';
  if (PIPELINE_STATUS.has(status) || (status === 'uploaded' && approvalStatus === 'approved')) {
    return '处理中';
  }
  return '待审';
}

/** 当前已加载行本地筛。不写 URL；不是 LIST ACL。 */
export function filterDocumentRows(
  rows: DocumentListItem[],
  q: { ownerDeptId: 'all' | 'lib' | string; visibilityLevel: 'all' | VisibilityLevel },
): DocumentListItem[] {
  return rows.filter((row) => {
    const deptOk =
      q.ownerDeptId === 'all'
        ? true
        : q.ownerDeptId === 'lib'
          ? row.ownerDeptId == null
          : row.ownerDeptId === q.ownerDeptId;
    const visOk = q.visibilityLevel === 'all' ? true : row.visibilityLevel === q.visibilityLevel;
    return deptOk && visOk;
  });
}
