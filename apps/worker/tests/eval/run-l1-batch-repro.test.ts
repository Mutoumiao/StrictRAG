/**
 * 目标：worker L1 批跑必须与 api CLI 落同形状的 PRD §8 可复现区块，且落库白名单不得把它静默丢弃。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段
 * 被测：runL1Batch · evalPersist.saveReport（reportJson 逐键白名单）
 * 简介：区块键集 = contracts `emptyL1Repro()` 同形状；题面 ID 哈希按 case_key 集合算；取不到的分项为 null；白名单保留 repro。
 */

import { describe, expect, it, vi } from 'vitest';

import { emptyL1Repro, l1QuestionIdsHash } from '@strict-rag/contracts/eval-repro';

/** saveReport 写入的 set 载荷（不连真 PG） */
const captured: { values?: Record<string, unknown> } = {};

vi.mock('../../src/env.js', () => ({ env: { EVAL_L2_GOLD_PATH: '' } }));
vi.mock('../../src/db.js', () => ({
  getDb: () => ({
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async () => {
          captured.values = values;
        },
      }),
    }),
  }),
}));

const { runL1Batch } = await import('../../src/eval/run-l1-batch.js');
const { evalPersist } = await import('../../src/eval/persist.js');

const CASES = [
  { caseKey: 'a1', question: '可答题', type: 'answerable' as const },
  { caseKey: 'u1', question: '不可答题', type: 'unanswerable' as const },
];

function batch() {
  return runL1Batch({
    kbId: 'kb-1',
    retrieveMode: 'mock',
    cases: CASES,
    execute: async ({ caseKey }) =>
      caseKey === 'a1' ? { outcome: 'answered' } : { outcome: 'abstained' },
  });
}

describe('runL1Batch · §8 可复现区块', () => {
  it('区块与 api 侧同形状（键集 = contracts emptyL1Repro）', async () => {
    const report = await batch();
    expect(Object.keys(report.repro).sort()).toEqual(Object.keys(emptyL1Repro()).sort());
    expect(Object.keys(report.repro.models).sort()).toEqual(['env', 'kbBindings']);
    expect(Object.keys(report.repro.models.env).sort()).toEqual(['chat', 'embed', 'rerank']);
  });

  it('题面 ID 哈希按 case_key 集合算（换序同值）', async () => {
    const report = await batch();
    expect(report.repro.questionIdsHash).toBe(l1QuestionIdsHash(['a1', 'u1']));
    expect(report.repro.questionIdsHash).toBe(l1QuestionIdsHash(['u1', 'a1']));
    expect(report.repro.questionIdsHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('worker 取不到的分项一律 null（模型 / 档位预算 / 校准集哈希 / 版本类）；τ 未下发时为 null', async () => {
    const report = await batch();
    expect(report.repro.models.env).toEqual({ chat: null, embed: null, rerank: null });
    expect(report.repro.models.kbBindings).toBeNull();
    expect(report.repro.retrieveK).toBeNull();
    expect(report.repro.rerankTopN).toBeNull();
    expect(report.repro.tauClaim).toBeNull();
    expect(report.repro.calibrationHash).toBeNull();
    expect(report.repro.seed).toBeNull();
    expect(report.repro.fallbackChainsVersion).toBeNull();
    expect(report.repro.crag).toBeNull();
    expect(report.repro.contextMode).toBeNull();
    expect(report.repro.promptVersions).toBeNull();
    expect(report.repro.lifecycleFilterVersion).toBeNull();
    expect(report.repro.sessionStrategyVersion).toBeNull();
    expect(report.repro.l2GoldSetHash).toBeNull();

    const serialized = JSON.stringify(report.repro);
    for (const fake of ['"unknown"', '"-"', '""', '"n/a"']) {
      expect(serialized).not.toContain(fake);
    }
  });
});

describe('saveReport · reportJson 白名单不得静默丢键（两侧同构）', () => {
  it('落库 JSON 保留 repro，且报告上的每个键都在白名单里', async () => {
    const report = await batch();
    captured.values = undefined;

    await evalPersist.saveReport('01900000-0000-7000-8000-0000000000aa', report);

    const reportJson = captured.values?.reportJson as Record<string, unknown> | undefined;
    expect(reportJson).toBeDefined();
    expect(reportJson?.repro).toEqual(report.repro);

    // 逐键白名单漏一个键 → 该键在库内静默消失；本断言钉住「报告有的，库内也能看到」
    const missing = Object.keys(report).filter(
      (key) => key !== 'retrieveMode' && !(key in (reportJson ?? {})),
    );
    expect(missing).toEqual([]);
  });
});

describe('runL1Batch · τ 由执行侧（api 内口）下发后记进报告', () => {
  /** 执行侧下发同一个 τ 时才可记；否则报告如实记 null（不拿 worker 自己的 env 顶上） */
  function batchWithTaus(taus: Array<number | undefined>) {
    return runL1Batch({
      kbId: 'kb-1',
      retrieveMode: 'live',
      cases: CASES,
      execute: async ({ caseKey }) => ({
        outcome: caseKey === 'a1' ? 'answered' : 'abstained',
        tauClaim: taus[caseKey === 'a1' ? 0 : 1],
      }),
    });
  }

  it('整批同值 → 记进 repro.tauClaim（0 与 1 都是合法值，不得当假值丢）', async () => {
    expect((await batchWithTaus([0.6, 0.6])).repro.tauClaim).toBe(0.6);
    expect((await batchWithTaus([0, 0])).repro.tauClaim).toBe(0);
    expect((await batchWithTaus([1, 1])).repro.tauClaim).toBe(1);
  });

  it('只部分题下发 → 记 null（证据不齐：不能拿一题的 τ 代表整批）', async () => {
    expect((await batchWithTaus([0.6, undefined])).repro.tauClaim).toBeNull();
    expect((await batchWithTaus([undefined, 0.6])).repro.tauClaim).toBeNull();
  });

  it('error 题不下发不阻塞：其余非 error 题齐且同值 → 照记', async () => {
    const report = await runL1Batch({
      kbId: 'kb-1',
      retrieveMode: 'live',
      cases: CASES,
      execute: async ({ caseKey }) =>
        caseKey === 'a1'
          ? { outcome: 'answered', tauClaim: 0.6 }
          : { outcome: 'error', errorMessage: 'boom' },
    });
    expect(report.repro.tauClaim).toBe(0.6);
  });

  it('分歧 / 全缺 → 记 null（不猜、不取 worker 侧 TAU_CLAIM）', async () => {
    expect((await batchWithTaus([0.6, 0.7])).repro.tauClaim).toBeNull();
    expect((await batchWithTaus([undefined, undefined])).repro.tauClaim).toBeNull();
  });

  it('非有限数按未下发处理（NaN / Infinity 不得写进合同字段）', async () => {
    expect((await batchWithTaus([Number.NaN, Number.NaN])).repro.tauClaim).toBeNull();
    expect(
      (await batchWithTaus([Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY])).repro.tauClaim,
    ).toBeNull();
  });
});
