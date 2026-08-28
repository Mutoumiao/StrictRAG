'use client';

import type { ForUploadResponse } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { completeUpload, getChunkStrategiesForUpload, putUploadedObject, requestUploadUrl } from './api';

export type UploadDocumentResult =
  | { ok: true; docId: string }
  | { ok: false; message: string };

export function pickUploadChunkStrategy(
  plan: ForUploadResponse,
  picked?: string,
): { ok: true; code: string } | { ok: false; message: string } {
  const code = picked?.trim() || plan.autoCode || plan.recommendedCode;
  if (!code) {
    return { ok: false, message: '请选择分片策略' };
  }
  if (plan.available.length > 0 && !plan.available.some((a) => a.code === code)) {
    return { ok: false, message: '请选择分片策略' };
  }
  return { ok: true, code };
}

export async function planUploadChunkStrategy(
  kbId: string,
  contentType: string,
): Promise<{ ok: true; plan: ForUploadResponse } | { ok: false; message: string }> {
  try {
    const plan = await getChunkStrategiesForUpload(kbId, contentType);
    return { ok: true, plan };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function uploadAdminDocument(
  kbId: string,
  file: File,
  chunkStrategy: string,
): Promise<UploadDocumentResult> {
  try {
    const contentType = file.type || 'text/plain';
    const slot = await requestUploadUrl(kbId, {
      title: file.name || 'upload',
      contentType,
      declaredByteSize: file.size,
    });
    await putUploadedObject(slot.uploadUrl, file, contentType);
    await completeUpload(kbId, slot.docId, { chunkStrategy });
    return { ok: true, docId: slot.docId };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
