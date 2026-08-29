/**
 * 目标：eval 消费者须写 running→succeeded，空题集 failed，非法 payload 拒绝。
 * 需求：prds/06-async eval.run · 功能表 §5.2
 * 被测：handleEvalJob
 * 简介：注入 persist 与 execute；不打 live LLM。
 */

import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { handleEvalJob } from '../../src/eval/consumer.js';
import type { EvalPersist } from '../../src/eval/persist.js';
import type { L1BatchReport } from '../../src/eval/run-l1-batch.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

function job(runId: string) {
  return {
    tenantId: TENANT,
    kbId: KB,
    runId,
    userId: uuidv7(),
    retrieveMode: 'mock' as const,
  };
}

function memoryPersist(opts: { gold: boolean }): EvalPersist & {
  status: string;
  saved: L1BatchReport | null;
  failed?: string;
} {
  const state: {
    status: string;
    saved: L1BatchReport | null;
    failed?: string;
  } = { status: 'queued', saved: null };
  return {
    get status() {
      return state.status;
    },
    get saved() {
      return state.saved;
    },
    get failed() {
      return state.failed;
    },
    async loadGold() {
      if (!opts.gold) return [];
      return [{ caseKey: 'g1', question: '住宿？', type: 'answerable' as const }];
    },
    async markRunning() {
      state.status = 'running';
    },
    async markFailed(_id, message) {
      state.status = 'failed';
      state.failed = message;
    },
    async saveReport(_id, report) {
      state.status = 'succeeded';
      state.saved = report;
    },
  };
}

describe('handleEvalJob', () => {
  it('有题则跑批并 saveReport', async () => {
    const runId = uuidv7();
    const persist = memoryPersist({ gold: true });
    const r = await handleEvalJob(job(runId), {
      persist,
      executeFor: () => async () => ({ outcome: 'answered' }),
    });
    expect(r).toEqual({ ok: true, caseCount: 1 });
    expect(persist.status).toBe('succeeded');
    expect(persist.saved?.matrix.A).toBe(1);
    expect(persist.saved?.signoffEligible).toBe(false);
  });

  it('空黄金集 → failed', async () => {
    const persist = memoryPersist({ gold: false });
    const r = await handleEvalJob(job(uuidv7()), { persist });
    expect(r.ok).toBe(false);
    expect(persist.status).toBe('failed');
  });

  it('非法 payload 不写库', async () => {
    const r = await handleEvalJob({ kbId: 'nope' });
    expect(r).toEqual({ ok: false, error: 'invalid eval job payload' });
  });
});
