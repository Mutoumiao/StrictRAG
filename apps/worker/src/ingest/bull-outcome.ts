import { UnrecoverableError } from 'bullmq';

import { classifyIngestBullOutcome } from './idempotency.js';

/**
 * 业务 errorCode → BullMQ 终态（X-04 重试矩阵接线）。
 * - 无 errorCode：阶段成功结束
 * - retryable：抛 Error → attempts/backoff
 * - 其它：UnrecoverableError → 禁止毒丸重投（含 MALWARE）
 */
export function assertIngestBullOutcome(errorCode: string | undefined): void {
  const outcome = classifyIngestBullOutcome(errorCode);
  if (outcome === 'complete') return;
  if (outcome === 'retry') {
    throw new Error(`ingest retryable failure: ${errorCode}`);
  }
  throw new UnrecoverableError(`ingest unrecoverable: ${errorCode}`);
}
