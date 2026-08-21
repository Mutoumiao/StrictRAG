'use client';

import { mapBizError } from '@/lib/map-biz-error';

import { patchDocumentLifecycle } from './api';

export async function setDocumentLifecycle(docId: string, lifecycle: 'active' | 'draft') {
  try {
    const data = await patchDocumentLifecycle(docId, { lifecycle });
    return { ok: true as const, lifecycle: data.lifecycle };
  } catch (err) {
    return { ok: false as const, message: mapBizError(err) };
  }
}

export function canPublish(status: string, lifecycle: string): boolean {
  return status === 'ready' && lifecycle !== 'active';
}

export function canRevertDraft(lifecycle: string): boolean {
  return lifecycle === 'active';
}
