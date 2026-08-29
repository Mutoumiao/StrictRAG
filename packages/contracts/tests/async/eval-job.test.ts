/**
 * 目标：评测 job payload 必须带 tenant/kb/run，拒绝缺字段与非法 retrieveMode。
 * 需求：prds/06-async eval.run
 * 被测：EvalJobDataSchema · QUEUE_NAMES.EVAL · EVAL_JOB_NAME
 * 简介：api 入队与 worker 消费同一形状；只跑 golden_2x2。
 */

import { describe, expect, it } from 'vitest';

import {
  EVAL_JOB_DEFAULT_ATTEMPTS,
  EVAL_JOB_NAME,
  EvalJobDataSchema,
  QUEUE_NAMES,
} from '../../src/async/queues.js';

describe('EvalJobDataSchema', () => {
  const valid = {
    tenantId: '01900000-0000-7000-8000-000000000001',
    kbId: '01900000-0000-7000-8000-0000000000aa',
    runId: '01900000-0000-7000-8000-0000000000ee',
    userId: '01900000-0000-7000-8000-0000000000e1',
    retrieveMode: 'mock' as const,
  };

  it('accepts golden payload and rejects extra keys', () => {
    expect(EvalJobDataSchema.parse(valid).runId).toBe(valid.runId);
    expect(EvalJobDataSchema.safeParse({ ...valid, tauClaim: 0.4 }).success).toBe(false);
  });

  it('rejects missing runId and bad retrieveMode', () => {
    expect(
      EvalJobDataSchema.safeParse({
        tenantId: valid.tenantId,
        kbId: valid.kbId,
        userId: valid.userId,
        retrieveMode: valid.retrieveMode,
      }).success,
    ).toBe(false);
    expect(EvalJobDataSchema.safeParse({ ...valid, retrieveMode: 'prod' }).success).toBe(false);
  });

  it('queue name and attempts stay eval-specific', () => {
    expect(QUEUE_NAMES.EVAL).toBe('sr-eval');
    expect(EVAL_JOB_NAME).toBe('golden_2x2');
    expect(EVAL_JOB_DEFAULT_ATTEMPTS).toBe(1);
  });
});
