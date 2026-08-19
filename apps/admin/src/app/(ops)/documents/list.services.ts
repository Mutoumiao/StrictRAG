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
