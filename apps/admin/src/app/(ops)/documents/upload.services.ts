'use client';

import { resolveIngestContentType, type ForUploadResponse } from '@strict-rag/contracts';

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

export function resolveUploadContentType(
  file: File,
): { ok: true; contentType: string } | { ok: false; message: string } {
  const contentType = resolveIngestContentType({
    contentType: file.type,
    fileName: file.name,
  });
  if (!contentType) {
    return { ok: false, message: 'UNSUPPORTED_MEDIA_TYPE: 不支持的文件类型' };
  }
  return { ok: true, contentType };
}

export async function uploadAdminDocument(
  kbId: string,
  file: File,
  chunkStrategy: string,
): Promise<UploadDocumentResult> {
  const media = resolveUploadContentType(file);
  if (!media.ok) return media;
  try {
    const slot = await requestUploadUrl(kbId, {
      title: file.name || 'upload',
      contentType: media.contentType,
      declaredByteSize: file.size,
    });
    const put = await putUploadedObject(slot.uploadUrl, file, media.contentType);
    await completeUpload(kbId, slot.docId, {
      chunkStrategy,
      checksumSha256: put.checksumSha256,
    });
    return { ok: true, docId: slot.docId };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
