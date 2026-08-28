'use client';

import type { ForUploadResponse, ReindexDocumentResponse } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { reindexDocument } from './api';
import { pickUploadChunkStrategy, planUploadChunkStrategy } from './upload.services';

export function pickReindexChunkStrategy(
  plan: ForUploadResponse,
  picked?: string,
): { ok: true; code: string } | { ok: false; message: string } {
  if (plan.requireExplicit && !picked?.trim()) {
    return { ok: false, message: '请选择分片策略' };
  }
  return pickUploadChunkStrategy(plan, picked);
}

export async function planReindexChunkStrategy(
  kbId: string,
  contentType: string,
): Promise<{ ok: true; plan: ForUploadResponse } | { ok: false; message: string }> {
  return planUploadChunkStrategy(kbId, contentType);
}

export async function reindexAdminDocument(
  docId: string,
  chunkStrategy: string,
): Promise<
  { ok: true; data: ReindexDocumentResponse } | { ok: false; message: string }
> {
  try {
    const data = await reindexDocument(docId, { chunkStrategy });
    return { ok: true, data };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}