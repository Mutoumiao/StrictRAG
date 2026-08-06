'use client';

/**
 * 审批用例：列表加载 · 通过/驳回 · scan（含成功后刷新列表）。
 * 无 path；不做权限决策。
 */

import type { DocumentListItem } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { loadDocumentList } from '../documents/list.services';
import { approveDocument, rejectDocument, scanDocument } from './api';

export type LoadApprovalsResult =
  | { ok: true; rows: DocumentListItem[] }
  | { ok: false; message: string };

export type ActionResult = { ok: true; text: string } | { ok: false; message: string };

export type ApprovalAction = 'approve' | 'reject' | 'scan';

export type ApplyApprovalResult =
  | { ok: true; text: string; rows: DocumentListItem[] }
  | { ok: false; message: string };

const APPROVAL_ACTIONS: Record<
  ApprovalAction,
  { run: (docId: string) => Promise<unknown>; text: string }
> = {
  approve: {
    run: approveDocument,
    text: '已通过（尚未 scan；未批不可 scan）',
  },
  reject: {
    run: rejectDocument,
    text: '已驳回',
  },
  scan: {
    run: scanDocument,
    text: '已入队 scan',
  },
};

/** 与文档列表同源；复用 documents 的 list 用例（仅错误映射，无 toast 语义）。 */
export async function loadApprovalsList(kbId: string): Promise<LoadApprovalsResult> {
  return loadDocumentList(kbId);
}

export async function runApprovalAction(
  docId: string,
  action: ApprovalAction,
): Promise<ActionResult> {
  const step = APPROVAL_ACTIONS[action];
  try {
    await step.run(docId);
    return { ok: true, text: step.text };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

/** 动作 + 刷新列表（用例控制流收在 services）。 */
export async function applyApprovalAction(
  kbId: string,
  docId: string,
  action: ApprovalAction,
): Promise<ApplyApprovalResult> {
  const ran = await runApprovalAction(docId, action);
  if (!ran.ok) return ran;

  const list = await loadApprovalsList(kbId);
  if (!list.ok) {
    return {
      ok: true,
      text: `${ran.text}（列表刷新失败：${list.message}）`,
      rows: [],
    };
  }
  return { ok: true, text: ran.text, rows: list.rows };
}
