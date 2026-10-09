'use client';

/**
 * 跨文档近重复「待审冲突」的运营可见与处置（剧本 E4 · 功能表 §4.3）。
 *
 * 可见 = 从**已加载**的入库报告里挑出 `pending_review` 且带 `heldChunkId` 的冲突对（只有这些能处置）；
 * 处置 = 调**既有**端点；**不**代跑 reindex（`winner='this'` 会回 `reindexRequired`，须运营自行 Reindex）。
 * 数据来源本就是文档页已拉取的入库报告，**不**新增读端点（见本图工单 02 裁定）。
 */

import type { IngestReportItem } from '@strict-rag/contracts';

import { ApiHttpError } from '@/lib/http';
import { mapBizError } from '@/lib/map-biz-error';

import { resolveDedupeConflict } from './api';

/** 可处置的一条待审冲突：被拦下的本块 + 它所指的对方块。 */
export type PendingReviewConflict = {
  heldChunkId: string;
  otherDocId: string;
  otherChunkId: string;
};

/**
 * 可处置的待审冲突：`action='pending_review'` **且**带 `heldChunkId`。
 * `skip_index` 项虽同进 `conflictPairs`，但块已被丢弃、无待办；缺 `heldChunkId` 的项不进处置面
 * （不给运营一个点不动的按钮）。按 `heldChunkId` 去重：同一块在不同 `indexVersion` 的报告里只列一次。
 */
export function pendingReviewConflicts(
  reports: readonly IngestReportItem[],
): PendingReviewConflict[] {
  const seen = new Set<string>();
  const out: PendingReviewConflict[] = [];
  for (const report of reports) {
    for (const pair of report.conflictPairs) {
      const held = pair.heldChunkId;
      if (pair.action !== 'pending_review' || typeof held !== 'string' || held.length === 0) {
        continue;
      }
      if (seen.has(held)) continue;
      seen.add(held);
      out.push({ heldChunkId: held, otherDocId: pair.otherDocId, otherChunkId: pair.otherChunkId });
    }
  }
  return out;
}

/** 两个选项的运营文案：`this` = 保留本块；`other` = 保留对方块。 */
export function dedupeWinnerLabel(winner: 'this' | 'other'): string {
  return winner === 'this' ? '保留本块' : '保留对方块';
}

export type ResolvePendingConflictResult =
  | { ok: true; reindexRequired: boolean; message: string }
  /** `terminal` = 该块已不可再处置（非待审 / 不存在）→ UI 应停用按钮，别让运营反复点。 */
  | { ok: false; terminal: boolean; message: string };

/** 落一次二选一；失败文案交运营读。 */
export async function resolvePendingConflict(input: {
  docId: string;
  heldChunkId: string;
  winner: 'this' | 'other';
}): Promise<ResolvePendingConflictResult> {
  try {
    const res = await resolveDedupeConflict(input.docId, input.heldChunkId, {
      winner: input.winner,
    });
    return {
      ok: true,
      reindexRequired: res.reindexRequired,
      message: res.reindexRequired
        ? '已保留本块：须对本文档重新入库（Reindex）后才会进入检索面'
        : '已保留对方块：本块维持不入索引',
    };
  } catch (err) {
    // 端点对「非 pending_review」回 400、对「块不存在」回 404 —— 两者都是终态，停用该行按钮。
    const terminal =
      err instanceof ApiHttpError &&
      (err.code === 'VALIDATION_ERROR' || err.code === 'NOT_FOUND');
    return { ok: false, terminal, message: mapBizError(err) };
  }
}
