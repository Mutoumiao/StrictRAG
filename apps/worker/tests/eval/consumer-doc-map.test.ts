/**
 * 目标：评测消费者在「账本已设置但不可用」时必须响亮失败（markFailed + ok:false），不得静默降级成「未设置」。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §3 / §6（Hit@20 数据面）· 裁定 02（裁定 3）
 * 被测：handleEvalJob（L1 / L2 两条路径）
 * 简介：注入内存 persist；env 快照把 L1_DOC_MAP / L2_DOC_MAP 指到不存在的账本 → 两路径都失败且点名原因。
 */

import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import type { L2Case } from '@strict-rag/contracts';

import type { EvalPersist } from '../../src/eval/persist.js';
import type { L1BatchReport } from '../../src/eval/run-l1-batch.js';
import type { L2BatchReport } from '../../src/eval/run-l2-batch.js';

// env 是模块加载期快照：先设路径再动态 import，确保消费者读到的是「已设置但不可用」的账本。
process.env.L1_DOC_MAP = path.join(tmpdir(), 'missing-l1-ledger.json');
process.env.L2_DOC_MAP = path.join(tmpdir(), 'missing-l2-ledger.json');
const { handleEvalJob } = await import('../../src/eval/consumer.js');

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

function memoryPersist(opts: { l2?: L2Case[] }): EvalPersist & {
  status: string;
  failed?: string;
  saved: L1BatchReport | null;
  savedL2: L2BatchReport | null;
} {
  const state: {
    status: string;
    failed?: string;
    saved: L1BatchReport | null;
    savedL2: L2BatchReport | null;
  } = { status: 'queued', saved: null, savedL2: null };
  return {
    get status() {
      return state.status;
    },
    get failed() {
      return state.failed;
    },
    get saved() {
      return state.saved;
    },
    get savedL2() {
      return state.savedL2;
    },
    async loadGold() {
      return [{ caseKey: 'g1', question: '住宿？', type: 'answerable' as const }];
    },
    async loadL2Cases() {
      return opts.l2 ?? [];
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
    async saveL2Report(_id, report) {
      state.status = 'succeeded';
      state.savedL2 = report;
    },
  };
}

describe('handleEvalJob · 账本已设置但不可用', () => {
  it('L1：账本文件不存在 → markFailed 且 ok:false（不降级成「未设置」）', async () => {
    const persist = memoryPersist({});
    const r = await handleEvalJob(job(uuidv7()), {
      persist,
      executeFor: () => async () => ({ outcome: 'answered' }),
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot read corpus ledger/);
    expect(persist.status).toBe('failed');
    expect(persist.failed).toMatch(/cannot read corpus ledger/);
    // 未落任何「成功」报告
    expect(persist.saved).toBeNull();
  });

  it('L2：账本文件不存在 → markFailed 且 ok:false', async () => {
    const persist = memoryPersist({
      l2: [
        {
          id: 'l2-near-001',
          type: 'near_coref',
          turns: [
            { role: 'user', text: '住宿？', session: 'same' },
            { role: 'user', text: '那餐补呢', session: 'same' },
          ],
          expected: { themePersist: true, historyInEvidence: false, rewriteUsed: false, accept: ['answered'] },
          rubric: 'r',
        },
      ],
    });
    const r = await handleEvalJob(
      { ...job(uuidv7()), runType: 'session_multiturn' },
      {
        persist,
        executeL2For: () => async () => ({
          outcome: 'answered',
          rewriteUsed: false,
          evidenceTexts: ['条款'],
          answer: 'ok',
        }),
      },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot read corpus ledger/);
    expect(persist.status).toBe('failed');
    expect(persist.savedL2).toBeNull();
  });
});
