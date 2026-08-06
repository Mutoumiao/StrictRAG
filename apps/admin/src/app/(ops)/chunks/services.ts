'use client';

/**
 * 分片只读用例：调 api、错误映射。
 * 无 path；不做权限决策。
 */

import type { ChunkDetail, ChunkListItem, DocumentListItem } from '@strict-rag/contracts';

import { mapBizError } from '@/lib/map-biz-error';

import { getChunkDetail, listChunks, listKbDocuments } from './api';

export type LoadDocsResult =
  | { ok: true; rows: DocumentListItem[] }
  | { ok: false; message: string };

export type LoadChunksResult =
  | {
      ok: true;
      items: ChunkListItem[];
      indexVersion: number;
      status?: string;
      lifecycle?: string;
      nextCursor: string | null;
    }
  | { ok: false; message: string };

export type LoadDetailResult =
  | { ok: true; detail: ChunkDetail }
  | { ok: false; message: string };

export async function loadChunkDocs(kbId: string): Promise<LoadDocsResult> {
  try {
    const rows = await listKbDocuments(kbId);
    return { ok: true, rows };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function loadChunkList(
  docId: string,
  opts?: { limit?: number; cursor?: string },
): Promise<LoadChunksResult> {
  try {
    const data = await listChunks(docId, opts);
    return {
      ok: true,
      items: data.items,
      indexVersion: data.indexVersion,
      status: data.status,
      lifecycle: data.lifecycle,
      nextCursor: data.nextCursor,
    };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}

export async function loadChunkBody(docId: string, chunkId: string): Promise<LoadDetailResult> {
  try {
    const detail = await getChunkDetail(docId, chunkId);
    return { ok: true, detail };
  } catch (err) {
    return { ok: false, message: mapBizError(err) };
  }
}
