/**
 * worker 侧评测账本对账的库读入口 + 仓库根口径（小模块）。
 *
 * `lookupDocRefs` 的列与 api 侧 `documentRepo.listDocRefsByIds` **同形状**
 * （`docId` / `kbId` / `title` / `status` / `lifecycle`），供 `runL1Batch` / `runL2Batch`
 * 作为 `resolveCorpusLedgerForRun` 的缺省 `lookupDocs` 注入（生产路径不可绕，测试注入桩）。
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { LedgerDocRef } from '@strict-rag/contracts/eval-corpus-ledger';
import { documents } from '@strict-rag/db';
import { inArray } from 'drizzle-orm';

import { getDb } from '../db.js';

/**
 * 按 id 批量查 `documents` 的对账投影；`ids` 空 → `[]`（**不发查询**）。
 * 缺失的行**不补桩**：库内没有就是不返回，由 `diffLedgerAgainstDocs` 判为 `missing`。
 */
export async function lookupDocRefs(ids: readonly string[]): Promise<LedgerDocRef[]> {
  if (ids.length === 0) return [];
  return getDb()
    .select({
      docId: documents.id,
      kbId: documents.kbId,
      title: documents.title,
      status: documents.status,
      lifecycle: documents.lifecycle,
    })
    .from(documents)
    .where(inArray(documents.id, [...ids]));
}

/**
 * monorepo 根：本文件在 `apps/worker/src/eval`，上溯 4 层即仓根。口径与 `persist.ts`
 * 的 `defaultL2GoldPath` 逐字一致（同一表达式），**不**另写硬编码层数。
 */
export function evalRepoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
}
