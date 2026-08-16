'use client';

/**
 * 文档部门元数据用例：加载详情 + 保存。
 * 无 path；不做权限决策（UI 裁剪 + API 硬验）。
 */

import type { DocumentDetail, PatchDocumentMetaBody } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { getDocument, patchDocumentMeta } from './api';

export type LoadDocumentDetailResult =
  | { ok: true; detail: DocumentDetail }
  | { ok: false; message: string };

export type SaveDocumentMetaResult =
  | { ok: true; detail: DocumentDetail }
  | { ok: false; message: string };

export async function loadDocumentDetail(docId: string): Promise<LoadDocumentDetailResult> {
  try {
    const detail = await getDocument(docId);
    return { ok: true, detail };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function saveDocumentMeta(
  docId: string,
  body: PatchDocumentMetaBody,
): Promise<SaveDocumentMetaResult> {
  try {
    const detail = await patchDocumentMeta(docId, body);
    return { ok: true, detail };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
