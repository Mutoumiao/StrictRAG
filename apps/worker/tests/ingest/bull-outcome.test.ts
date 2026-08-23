/**
 * 目标：入库错误码须正确映射为可重试或不可恢复。
 * 需求：prds/06-async
 * 被测：assertIngestBullOutcome
 * 简介：EMBED_FAILED 可重试；MALWARE 不可恢复；无码 complete。
 */
import { UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vitest';

import { assertIngestBullOutcome } from '../../src/ingest/bull-outcome.js';

describe('assertIngestBullOutcome · BullMQ 接线', () => {
  it('EMBED_FAILED → plain Error（可 attempts 重试）', () => {
    try {
      assertIngestBullOutcome('EMBED_FAILED');
      expect.fail('should throw');
    } catch (e) {
      expect(e).toBeInstanceOf(Error);
      expect(e).not.toBeInstanceOf(UnrecoverableError);
      expect((e as Error).message).toMatch(/EMBED_FAILED/);
    }
  });

  it('MALWARE → UnrecoverableError（不可 requeue clean）', () => {
    expect(() => assertIngestBullOutcome('MALWARE')).toThrow(UnrecoverableError);
  });

  it('无 errorCode → 成功 complete', () => {
    expect(() => assertIngestBullOutcome(undefined)).not.toThrow();
  });
});
