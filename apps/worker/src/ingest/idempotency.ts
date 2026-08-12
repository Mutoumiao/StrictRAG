/**
 * 入库幂等 / 重试纯逻辑（X-04-impl）。
 * 契约：`.trellis/spec/worker/backend/ingest-idempotency.md`
 */

/** 业务层不可自动重试（须 Unrecoverable 或勿 requeue clean） */
export const NON_RETRYABLE_INGEST_CODES = [
  'MALWARE',
  'NOT_APPROVED',
  'NO_TEXT_LAYER',
  'UNSUPPORTED_CHUNK_STRATEGY',
  'EMPTY_CHUNKS',
  'SCAN_ENGINE_UNAVAILABLE',
  'NO_MANIFEST',
  'MISSING_INDEX_VERSION',
  'EMBED_NOT_READY',
  'IDEMPOTENT_CHUNK_FORBIDDEN',
  'DOC_NOT_FOUND',
  'UNKNOWN_STAGE',
] as const;

/** 可同 version 重试的瞬时/mock 失败 */
export const RETRYABLE_INGEST_CODES = [
  'EMBED_FAILED',
  'ES_INDEX_FAILED',
  'ES_RECONCILE_FAILED',
] as const;

const NON_RETRYABLE = new Set<string>(NON_RETRYABLE_INGEST_CODES);
const RETRYABLE = new Set<string>(RETRYABLE_INGEST_CODES);

/**
 * 业务 errorCode 是否允许自动重试（同 indexVersion 路径）。
 * 未知码默认 **否**（fail-closed，避免毒丸循环）。
 */
export function isIngestErrorRetryable(errorCode: string | null | undefined): boolean {
  if (!errorCode) return false;
  if (NON_RETRYABLE.has(errorCode)) return false;
  return RETRYABLE.has(errorCode);
}

/**
 * 阶段终态如何交给 BullMQ：
 * - complete：业务成功结束（ready / needs_ocr 已落库终态且无 errorCode 时由调用方 complete）
 * - retry：抛普通 Error，走 attempts/backoff
 * - unrecoverable：UnrecoverableError，禁止毒丸重投
 */
export type IngestBullOutcome = 'complete' | 'retry' | 'unrecoverable';

export function classifyIngestBullOutcome(
  errorCode: string | null | undefined,
): IngestBullOutcome {
  if (errorCode == null || errorCode === '') return 'complete';
  return isIngestErrorRetryable(errorCode) ? 'retry' : 'unrecoverable';
}

export type ChunkIdempotencyDecision =
  | { action: 'materialize' }
  | { action: 'resume_embed'; indexVersion: number }
  | {
      action: 'fail';
      errorCode: 'NO_MANIFEST' | 'IDEMPOTENT_CHUNK_FORBIDDEN';
      message: string;
    };

/**
 * chunk 阶段路径选择。
 *
 * - 无 job.indexVersion → 首跑/reindex：**物化**新 version
 * - 有 job.indexVersion 且该 version 已有冻结 manifest → **禁止重分块**，转 embed
 * - 有 job.indexVersion 但无 manifest → fail（勿伪造 chunk）
 */
export function decideChunkPath(
  jobIndexVersion: number | undefined,
  manifestExistsForJobVersion: boolean,
): ChunkIdempotencyDecision {
  if (jobIndexVersion == null) {
    return { action: 'materialize' };
  }
  if (!Number.isFinite(jobIndexVersion) || jobIndexVersion < 1) {
    return {
      action: 'fail',
      errorCode: 'IDEMPOTENT_CHUNK_FORBIDDEN',
      message: `invalid job.indexVersion=${String(jobIndexVersion)}; reindex without version or fix payload`,
    };
  }
  if (manifestExistsForJobVersion) {
    return { action: 'resume_embed', indexVersion: jobIndexVersion };
  }
  return {
    action: 'fail',
    errorCode: 'NO_MANIFEST',
    message: `chunk resume forbidden: indexVersion=${jobIndexVersion} has no frozen manifest; use reindex for a new version`,
  };
}

/**
 * 解析 embed/es 使用的 indexVersion。
 * 优先 job，其次 doc；均无效则 null（调用方 fail MISSING_INDEX_VERSION）。
 */
export function resolveIndexVersion(
  jobIndexVersion: number | undefined,
  docIndexVersion: number | null | undefined,
): number | null {
  if (jobIndexVersion != null && Number.isFinite(jobIndexVersion) && jobIndexVersion >= 1) {
    return jobIndexVersion;
  }
  if (docIndexVersion != null && Number.isFinite(docIndexVersion) && docIndexVersion >= 1) {
    return docIndexVersion;
  }
  return null;
}

/** manifest 中尚未有 embedding 行的 chunkId（同 version 幂等 skip） */
export function missingEmbeddingChunkIds(
  manifestChunkIds: readonly string[],
  alreadyEmbeddedChunkIds: Iterable<string>,
): string[] {
  const have = new Set(alreadyEmbeddedChunkIds);
  return manifestChunkIds.filter((id) => !have.has(id));
}

/** 下一 stage payload：透传并可选覆盖 indexVersion */
export function withStageAndVersion<T extends { stage: string; indexVersion?: number }>(
  data: T,
  stage: T['stage'] | (string & {}),
  indexVersion?: number,
): T {
  return {
    ...data,
    stage: stage as T['stage'],
    ...(indexVersion != null ? { indexVersion } : {}),
  };
}
