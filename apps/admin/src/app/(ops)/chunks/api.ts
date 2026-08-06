'use client';

/**
 * 分片只读：本模块私有 HTTP。
 * path 仅此处；文档列表复用 documents/api，禁止复制 path。
 */

import type { ChunkDetail, ChunkListResponse } from '@strict-rag/contracts';

import { http } from '@/lib/http';

import { listDocuments } from '../documents/api';

/** 跨模块复用 documents 列表，不复制 path */
export const listKbDocuments = listDocuments;

export async function listChunks(docId: string, query?: { limit?: number; cursor?: string }) {
  const sp = new URLSearchParams();
  if (query?.limit != null) sp.set('limit', String(query.limit));
  if (query?.cursor) sp.set('cursor', query.cursor);
  const q = sp.toString();
  return http.get<ChunkListResponse>(
    `/api/v1/documents/${docId}/chunks${q ? `?${q}` : ''}`,
  );
}

export async function getChunkDetail(docId: string, chunkId: string) {
  return http.get<ChunkDetail>(`/api/v1/documents/${docId}/chunks/${chunkId}`);
}
