'use client';

/**
 * 文档部门元数据用例：加载详情 + 保存 + 归属下拉选项。
 * 无 path；不做权限决策（UI 裁剪 + API 硬验）。
 */

import type { Department, DocumentDetail, PatchDocumentMetaBody } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { listDepartments } from '../departments/api';
import { getKbSettings } from '../kb/settings/api';
import { getDocument, patchDocumentMeta } from './api';

export type LoadDocumentDetailResult =
  | { ok: true; detail: DocumentDetail }
  | { ok: false; message: string };

export type SaveDocumentMetaResult =
  | { ok: true; detail: DocumentDetail }
  | { ok: false; message: string };

export type LoadDepartmentOptionsResult =
  | { ok: true; departments: Department[] }
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

/** 文档归属下拉选项。复用部门模块 api；无 path。调用方须自裁 dept.manage。 */
export async function loadDepartmentOptions(): Promise<LoadDepartmentOptionsResult> {
  try {
    const departments = await listDepartments();
    return { ok: true, departments };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export type LoadKbDocTypesResult =
  | { ok: true; docTypes: string[] }
  | { ok: false; message: string };

/** 本库已有类型枚举。走设置 GET（需 kb.config.write）；无 path。不重做类型 CRUD。 */
export async function loadKbDocTypes(kbId: string): Promise<LoadKbDocTypesResult> {
  try {
    const settings = await getKbSettings(kbId);
    return { ok: true, docTypes: settings.docTypes ?? [] };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
