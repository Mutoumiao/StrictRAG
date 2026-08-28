'use client';

import type { Lifecycle } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { patchDocumentLifecycle } from './api';

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
