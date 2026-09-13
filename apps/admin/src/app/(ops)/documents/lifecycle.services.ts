'use client';

import type { Lifecycle } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { patchDocumentLifecycle, postDocumentSupersede } from './api';

export async function setDocumentLifecycle(docId: string, lifecycle: Lifecycle) {
  try {
    const data = await patchDocumentLifecycle(docId, { lifecycle });
    return { ok: true as const, lifecycle: data.lifecycle };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

/** 上架仅 ready + draft；archived / superseded 不直接升 active。 */
export function canPublish(status: string, lifecycle: string): boolean {
  return status === 'ready' && lifecycle === 'draft';
}

export function canRevertDraft(lifecycle: string): boolean {
  return lifecycle === 'active';
}

export function canArchive(lifecycle: string): boolean {
  return lifecycle === 'draft' || lifecycle === 'active';
}

export function canSupersede(lifecycle: string): boolean {
  return lifecycle === 'draft' || lifecycle === 'active';
}

export async function supersedeAdminDocument(oldDocId: string, successorDocId: string) {
  try {
    const data = await postDocumentSupersede(oldDocId, { successorDocId });
    return { ok: true as const, data };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

/** 本页已加载行里可选后继：排除自己，仅 ready 且 draft|active。 */
export function eligibleSuccessorOptions(
  rows: readonly { id: string; title: string; status: string; lifecycle: string }[],
  currentId: string,
): { value: string; label: string }[] {
  return rows
    .filter(
      (row) =>
        row.id !== currentId &&
        row.status === 'ready' &&
        (row.lifecycle === 'draft' || row.lifecycle === 'active'),
    )
    .map((row) => ({ value: row.id, label: row.title }));
}

export function canSubmitSupersede(successorId: string): boolean {
  return successorId.trim().length > 0;
}
