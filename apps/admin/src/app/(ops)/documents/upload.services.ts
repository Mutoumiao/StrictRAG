'use client';

import { DEFAULT_CHUNK_STRATEGY } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { completeUpload, requestUploadUrl, putUploadedObject } from './api';

export type UploadDocumentResult =
  | { ok: true; docId: string }
  | { ok: false; message: string };

export async function uploadAdminDocument(kbId: string, file: File): Promise<UploadDocumentResult> {
  try {
    const contentType = file.type || 'text/plain';
    const slot = await requestUploadUrl(kbId, {
      title: file.name || 'upload',
      contentType,
      declaredByteSize: file.size,
    });
    await putUploadedObject(slot.uploadUrl, file, contentType);
    await completeUpload(kbId, slot.docId, { chunkStrategy: DEFAULT_CHUNK_STRATEGY });
    return { ok: true, docId: slot.docId };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
