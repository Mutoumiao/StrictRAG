import { chunks, documents } from '@strict-rag/db';
import { and, asc, eq, gt } from 'drizzle-orm';

import { getDb } from './db.js';

/** 列表 preview 展示上限（与 worker 写入对齐） */
export const CHUNK_PREVIEW_MAX = 200;
/** 详情 body 响应软上限（ADR-052） */
export const CHUNK_BODY_MAX_BYTES = 64 * 1024;

export type ChunkRow = {
  id: string;
  docId: string;
  indexVersion: number;
  ordinal: number;
  preview: string | null;
  bodyText: string | null;
  tokenCount: number | null;
};

export type DocChunkContext = {
  id: string;
  indexVersion: number;
  status: string;
  lifecycle: string;
};

export type ListChunksInput = {
  docId: string;
  limit: number;
  /** 上一页末 ordinal；首屏 undefined */
  cursorOrdinal?: number;
};

export type ChunksRepo = {
  getDoc(docId: string): Promise<DocChunkContext | null>;
  listByDocVersion(input: {
    docId: string;
    indexVersion: number;
    limit: number;
    cursorOrdinal?: number;
  }): Promise<ChunkRow[]>;
  getById(docId: string, chunkId: string, indexVersion: number): Promise<ChunkRow | null>;
};

export const chunksRepo: ChunksRepo = {
  async getDoc(docId) {
    const [row] = await getDb()
      .select({
        id: documents.id,
        indexVersion: documents.indexVersion,
        status: documents.status,
        lifecycle: documents.lifecycle,
      })
      .from(documents)
      .where(eq(documents.id, docId))
      .limit(1);
    return row ?? null;
  },

  async listByDocVersion({ docId, indexVersion, limit, cursorOrdinal }) {
    const conds = [eq(chunks.docId, docId), eq(chunks.indexVersion, indexVersion)];
    if (cursorOrdinal !== undefined) {
      conds.push(gt(chunks.ordinal, cursorOrdinal));
    }
    return getDb()
      .select({
        id: chunks.id,
        docId: chunks.docId,
        indexVersion: chunks.indexVersion,
        ordinal: chunks.ordinal,
        preview: chunks.preview,
        bodyText: chunks.bodyText,
        tokenCount: chunks.tokenCount,
      })
      .from(chunks)
      .where(and(...conds))
      .orderBy(asc(chunks.ordinal))
      .limit(limit);
  },

  async getById(docId, chunkId, indexVersion) {
    const [row] = await getDb()
      .select({
        id: chunks.id,
        docId: chunks.docId,
        indexVersion: chunks.indexVersion,
        ordinal: chunks.ordinal,
        preview: chunks.preview,
        bodyText: chunks.bodyText,
        tokenCount: chunks.tokenCount,
      })
      .from(chunks)
      .where(
        and(
          eq(chunks.id, chunkId),
          eq(chunks.docId, docId),
          eq(chunks.indexVersion, indexVersion),
        ),
      )
      .limit(1);
    return row ?? null;
  },
};

export function buildPreview(row: ChunkRow): { preview: string; previewTruncated: boolean } {
  const body = row.bodyText ?? '';
  const fromCol = row.preview ?? body.slice(0, CHUNK_PREVIEW_MAX);
  const preview =
    fromCol.length > CHUNK_PREVIEW_MAX ? fromCol.slice(0, CHUNK_PREVIEW_MAX) : fromCol;
  const previewTruncated = body.length > preview.length || fromCol.length > CHUNK_PREVIEW_MAX;
  return { preview, previewTruncated };
}

/** 按 UTF-8 字节软截断，避免中文 char≈byte 误判（ADR-052 64KiB） */
export function truncateUtf8ByBytes(
  raw: string,
  maxBytes: number,
): { text: string; truncated: boolean } {
  const buf = Buffer.from(raw, 'utf8');
  if (buf.byteLength <= maxBytes) {
    return { text: raw, truncated: false };
  }
  // 从 maxBytes 回退到合法 UTF-8 边界
  let end = maxBytes;
  while (end > 0 && (buf[end]! & 0xc0) === 0x80) end -= 1;
  return { text: buf.subarray(0, end).toString('utf8'), truncated: true };
}

export function buildBody(row: ChunkRow): { body: string; bodyTruncated: boolean } {
  const { text, truncated } = truncateUtf8ByBytes(row.bodyText ?? '', CHUNK_BODY_MAX_BYTES);
  return { body: text, bodyTruncated: truncated };
}

/** 内存 repo：单测用 */
export function createMemoryChunksRepo(seed: {
  docs: DocChunkContext[];
  chunks: ChunkRow[];
}): ChunksRepo {
  const docs = new Map(seed.docs.map((d) => [d.id, d]));
  const all = [...seed.chunks];
  return {
    async getDoc(docId) {
      return docs.get(docId) ?? null;
    },
    async listByDocVersion({ docId, indexVersion, limit, cursorOrdinal }) {
      return all
        .filter(
          (c) =>
            c.docId === docId &&
            c.indexVersion === indexVersion &&
            (cursorOrdinal === undefined || c.ordinal > cursorOrdinal),
        )
        .sort((a, b) => a.ordinal - b.ordinal)
        .slice(0, limit);
    },
    async getById(docId, chunkId, indexVersion) {
      return (
        all.find(
          (c) => c.id === chunkId && c.docId === docId && c.indexVersion === indexVersion,
        ) ?? null
      );
    },
  };
}
