import { UnrecoverableError } from 'bullmq';
import { describe, expect, it } from 'vitest';

import { assertIngestBullOutcome } from './bull-outcome.js';

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
