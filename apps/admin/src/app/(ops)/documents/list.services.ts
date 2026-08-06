'use client';

/**
 * 文档列表用例：调 api、错误映射。
 * 无 path；不做权限决策（UI 裁剪 + API 硬验）。
 */

import type { DocumentListItem } from '@strict-rag/contracts';

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
