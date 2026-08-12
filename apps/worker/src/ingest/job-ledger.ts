/**
 * ingest_jobs 阶段账本（最小）。
 * PRD：阶段边界写账本；HOW：ingest-idempotency §5 / capability-matrix。
 * ponytail: 无分布式锁；写失败只 warn，不阻断入库状态机。
 */

import { ingestJobs, type Db } from '@strict-rag/db';
import { eq } from 'drizzle-orm';
import { uuidv7 } from 'uuidv7';

import { logger } from '../logger.js';
import { QUEUE_NAMES } from '../queues.js';

export type LedgerJobStatus = 'running' | 'succeeded' | 'failed';

export type StageLedgerContext = {
  tenantId: string;
  kbId: string;
  docId: string;
  stage: string;
  indexVersion?: number | null;
  /** 默认 sr-ingest */
  queue?: string;
};

export type StageLedgerResultLike = {
  errorCode?: string;
  next?: { stage: string };
  done?: boolean;
};

/** jobName = 逻辑 stage（与 BullMQ job name 对齐） */
export function ledgerJobName(stage: string): string {
  return stage;
}

export function ledgerStatusFromResult(result: StageLedgerResultLike): LedgerJobStatus {
  return result.errorCode ? 'failed' : 'succeeded';
}

export function buildStageStartRow(ctx: StageLedgerContext) {
  const id = uuidv7();
  const stage = ctx.stage;
  return {
    id,
    tenantId: ctx.tenantId,
    kbId: ctx.kbId,
    docId: ctx.docId,
    queue: ctx.queue ?? QUEUE_NAMES.INGEST,
    jobName: ledgerJobName(stage),
    status: 'running' as const satisfies LedgerJobStatus,
    indexVersion: ctx.indexVersion ?? null,
    errorMessage: null as string | null,
    payload: { stage } as Record<string, unknown>,
  };
}

export function buildStageEndPatch(
  ctxStage: string,
  result: StageLedgerResultLike,
  indexVersion?: number | null,
) {
  const status = ledgerStatusFromResult(result);
  const payload: Record<string, unknown> = { stage: ctxStage };
  if (result.errorCode) payload.errorCode = result.errorCode;
  if (result.next?.stage) payload.nextStage = result.next.stage;
  if (result.done && !result.errorCode) payload.terminal = true;

  return {
    status,
    errorMessage: result.errorCode ?? null,
    ...(indexVersion != null ? { indexVersion } : {}),
    payload,
  };
}

/**
 * 阶段开始：insert running 行。失败返回 null（不抛）。
 */
export async function recordStageStart(
  db: Db,
  ctx: StageLedgerContext,
): Promise<string | null> {
  const row = buildStageStartRow(ctx);
  try {
    await db.insert(ingestJobs).values(row);
    return row.id;
  } catch (err) {
    logger.warn(
      { err, docId: ctx.docId, stage: ctx.stage },
      'ingest_jobs recordStageStart failed (non-blocking)',
    );
    return null;
  }
}

/**
 * 阶段结束：update status。jobId 空则 no-op。
 */
export async function recordStageEnd(
  db: Db,
  jobId: string | null,
  ctxStage: string,
  result: StageLedgerResultLike,
  indexVersion?: number | null,
): Promise<void> {
  if (!jobId) return;
  const patch = buildStageEndPatch(ctxStage, result, indexVersion);
  try {
    await db.update(ingestJobs).set(patch).where(eq(ingestJobs.id, jobId));
  } catch (err) {
    logger.warn(
      { err, jobId, stage: ctxStage },
      'ingest_jobs recordStageEnd failed (non-blocking)',
    );
  }
}
