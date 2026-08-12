import { describe, expect, it } from 'vitest';

import {
  classifyIngestBullOutcome,
  decideChunkPath,
  isIngestErrorRetryable,
  missingEmbeddingChunkIds,
  resolveIndexVersion,
  withStageAndVersion,
} from './idempotency.js';
import { mockEsStore } from './es-store.js';

describe('decideChunkPath · R-I-idem-2', () => {
  it('无 indexVersion → materialize（首跑/reindex）', () => {
    expect(decideChunkPath(undefined, false)).toEqual({ action: 'materialize' });
    expect(decideChunkPath(undefined, true)).toEqual({ action: 'materialize' });
  });

  it('有 indexVersion 且 manifest 在 → resume_embed，不抬 version', () => {
    expect(decideChunkPath(3, true)).toEqual({
      action: 'resume_embed',
      indexVersion: 3,
    });
  });

  it('有 indexVersion 无 manifest → fail NO_MANIFEST', () => {
    const d = decideChunkPath(2, false);
    expect(d.action).toBe('fail');
    if (d.action === 'fail') expect(d.errorCode).toBe('NO_MANIFEST');
  });

  it('非法 indexVersion → fail', () => {
    const d = decideChunkPath(0, true);
    expect(d.action).toBe('fail');
  });
});

describe('missingEmbeddingChunkIds · R-I-idem-1', () => {
  it('二次 embed 只补缺，已有 chunkId 不重复', () => {
    const manifest = ['c1', 'c2', 'c3'];
    expect(missingEmbeddingChunkIds(manifest, [])).toEqual(['c1', 'c2', 'c3']);
    expect(missingEmbeddingChunkIds(manifest, ['c1', 'c3'])).toEqual(['c2']);
    expect(missingEmbeddingChunkIds(manifest, ['c1', 'c2', 'c3'])).toEqual([]);
  });
});

describe('mock ES 同 version 重跑 · R-I-idem-3', () => {
  it('二次 bulkIndex 仍 reconcile ok；半套不得假 ok', () => {
    mockEsStore.reset();
    const ids = ['a', 'b'];
    // 中途：未 bulk 全量
    expect(mockEsStore.reconcile('d1', 1, ids).ok).toBe(false);

    mockEsStore.bulkIndex('d1', 1, ids);
    expect(mockEsStore.reconcile('d1', 1, ids).ok).toBe(true);

    // 同 version 再 bulk（模拟 ES fail 后重跑）
    mockEsStore.bulkIndex('d1', 1, ids);
    expect(mockEsStore.reconcile('d1', 1, ids).ok).toBe(true);
    expect(mockEsStore.listChunkIds('d1', 1).sort()).toEqual(['a', 'b']);
  });
});

describe('retryable 矩阵 · R-I-idem-4', () => {
  it('MALWARE / NOT_APPROVED 等不可重试 → BullMQ unrecoverable', () => {
    // HOW §7：MALWARE 不进入 parse 且不可 requeue clean
    expect(isIngestErrorRetryable('MALWARE')).toBe(false);
    expect(classifyIngestBullOutcome('MALWARE')).toBe('unrecoverable');
    expect(isIngestErrorRetryable('NOT_APPROVED')).toBe(false);
    expect(classifyIngestBullOutcome('NOT_APPROVED')).toBe('unrecoverable');
    expect(isIngestErrorRetryable('NO_TEXT_LAYER')).toBe(false);
    expect(isIngestErrorRetryable('UNSUPPORTED_CHUNK_STRATEGY')).toBe(false);
    expect(isIngestErrorRetryable('SCAN_ENGINE_UNAVAILABLE')).toBe(false);
    expect(isIngestErrorRetryable('NO_MANIFEST')).toBe(false);
    expect(isIngestErrorRetryable('MISSING_INDEX_VERSION')).toBe(false);
    // scan infected 路径只写 MALWARE 终态，禁止当 clean 重投
    expect(classifyIngestBullOutcome('MALWARE')).not.toBe('retry');
  });

  it('EMBED_FAILED / ES_* / DOC_LOCK_BUSY 可重试 → BullMQ retry', () => {
    expect(isIngestErrorRetryable('EMBED_FAILED')).toBe(true);
    expect(classifyIngestBullOutcome('EMBED_FAILED')).toBe('retry');
    expect(isIngestErrorRetryable('ES_INDEX_FAILED')).toBe(true);
    expect(classifyIngestBullOutcome('ES_INDEX_FAILED')).toBe('retry');
    expect(isIngestErrorRetryable('ES_RECONCILE_FAILED')).toBe(true);
    expect(classifyIngestBullOutcome('ES_RECONCILE_FAILED')).toBe('retry');
    expect(isIngestErrorRetryable('DOC_LOCK_BUSY')).toBe(true);
    expect(classifyIngestBullOutcome('DOC_LOCK_BUSY')).toBe('retry');
  });

  it('未知码 fail-closed 不可重试；成功无码 complete', () => {
    expect(isIngestErrorRetryable('SOMETHING_NEW')).toBe(false);
    expect(classifyIngestBullOutcome('SOMETHING_NEW')).toBe('unrecoverable');
    expect(isIngestErrorRetryable(null)).toBe(false);
    expect(classifyIngestBullOutcome(undefined)).toBe('complete');
  });
});

describe('resolveIndexVersion / withStageAndVersion', () => {
  it('优先 job version', () => {
    expect(resolveIndexVersion(2, 9)).toBe(2);
    expect(resolveIndexVersion(undefined, 4)).toBe(4);
    expect(resolveIndexVersion(undefined, 0)).toBe(null);
  });

  it('chain 透传 indexVersion', () => {
    const next = withStageAndVersion(
      { docId: 'd', stage: 'embed' as const, indexVersion: 5 },
      'es_index',
      5,
    );
    expect(next).toEqual({ docId: 'd', stage: 'es_index', indexVersion: 5 });
  });
});
