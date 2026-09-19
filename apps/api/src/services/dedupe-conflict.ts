/**
 * 剧本 E4：跨 doc 去重冲突的**人工二选一**（PRD 04 §5.1 · 数据 PRD §3.2）。
 *
 * 落点：`chunks.dedupe_status`（仅取值 `pending_review`，处理完回 `NULL`）+ `chunks.duplicate_of`。
 * 边界：本服务**只写这两列**，不跑 reindex（那是持 `doc.reindex` 的人的动作），
 *       也**不碰对方文档**（跨文档改他人检索面无 PRD 依据）。
 */

import type { DedupeConflictWinner } from '@strict-rag/contracts';
import { chunks } from '@strict-rag/db';
import { and, eq } from 'drizzle-orm';

import { getDb } from './db.js';

export const DEDUPE_STATUS_PENDING_REVIEW = 'pending_review';

export type DedupeReviewChunk = {
  chunkId: string;
  docId: string;
  kbId: string;
  indexVersion: number;
  dedupeStatus: string | null;
  duplicateOf: string | null;
};

export type DedupeConflictRepo = {
  getChunk(docId: string, chunkId: string): Promise<DedupeReviewChunk | null>;
  /** 落决定：`other` 保留 `duplicate_of`（本块判为重复）；`this` 清 `duplicate_of`（本块为正牌） */
  resolve(input: {
    docId: string;
    chunkId: string;
    winner: DedupeConflictWinner;
  }): Promise<void>;
};

export const dedupeConflictRepo: DedupeConflictRepo = {
  async getChunk(docId, chunkId) {
    const [row] = await getDb()
      .select({
        id: chunks.id,
        docId: chunks.docId,
        kbId: chunks.kbId,
        indexVersion: chunks.indexVersion,
        dedupeStatus: chunks.dedupeStatus,
        duplicateOf: chunks.duplicateOf,
      })
      .from(chunks)
      .where(and(eq(chunks.docId, docId), eq(chunks.id, chunkId)))
      .limit(1);
    if (!row) return null;
    return {
      chunkId: row.id,
      docId: row.docId,
      kbId: row.kbId,
      indexVersion: row.indexVersion,
      dedupeStatus: row.dedupeStatus ?? null,
      duplicateOf: row.duplicateOf ?? null,
    };
  },

  async resolve({ docId, chunkId, winner }) {
    await getDb()
      .update(chunks)
      .set(
        winner === 'this'
          ? { dedupeStatus: null, duplicateOf: null }
          : { dedupeStatus: null },
      )
      .where(and(eq(chunks.docId, docId), eq(chunks.id, chunkId)));
  },
};

export function createMemoryDedupeConflictRepo(seed: DedupeReviewChunk[]): DedupeConflictRepo {
  const rows = seed.map((r) => ({ ...r }));
  return {
    async getChunk(docId, chunkId) {
      return rows.find((r) => r.docId === docId && r.chunkId === chunkId) ?? null;
    },
    async resolve({ docId, chunkId, winner }) {
      const row = rows.find((r) => r.docId === docId && r.chunkId === chunkId);
      if (!row) return;
      row.dedupeStatus = null;
      if (winner === 'this') row.duplicateOf = null;
    },
  };
}

/** 待审块必须真是 `pending_review`；其余一律拒绝（不猜、不幂等重放）。 */
export function evaluateResolveRequest(
  chunk: DedupeReviewChunk | null,
):
  | { ok: true }
  | {
      ok: false;
      code: 'NOT_FOUND' | 'VALIDATION_ERROR';
      message: string;
      httpStatus: 404 | 400;
    } {
  if (!chunk) {
    return { ok: false, code: 'NOT_FOUND', message: 'chunk not found', httpStatus: 404 };
  }
  if (chunk.dedupeStatus !== DEDUPE_STATUS_PENDING_REVIEW) {
    return {
      ok: false,
      code: 'VALIDATION_ERROR',
      message: 'chunk is not pending_review',
      httpStatus: 400,
    };
  }
  return { ok: true };
}
