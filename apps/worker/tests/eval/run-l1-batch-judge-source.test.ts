/**
 * 目标：worker L1 批跑的打分器来源判别必须与 api CLI 同构（同名声明、同一套三态映射、同一报告字段名），
 *       且落库白名单不得把新键静默丢弃。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §4（校准 ≥100）· §6（Judge AUROC ≥0.65）· §6.1（mock 数字禁进签字包）· ADR-046
 * 被测：runL1Batch · evalPersist.saveReport（reportJson 逐键白名单）
 * 简介：三态声明 → 报告 `judgeAurocSource`（off→none / mock→mock / http→live）；捕获 set 载荷证明报告有的键库内也能看到。
 */

import { describe, expect, it, vi } from 'vitest';
import { JUDGE_CALIB_MIN_CASES, type JudgeCalibCase } from '@strict-rag/contracts';

/** saveReport 写入的 set 载荷（不连真 PG） */
const captured: { values?: Record<string, unknown> } = {};

vi.mock('../../src/env.js', () => ({ env: { EVAL_L2_GOLD_PATH: '', JUDGE_CALIB_SCORER: 'off' } }));
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

/** 50 支持 + 50 不支持 = 恰 100 条（PRD §4 规模）；与 label 同源 → AUROC 恒 1 */
function calib100(): JudgeCalibCase[] {
  return [
    ...Array.from({ length: 50 }, (_, i) => ({
      id: `jc-p${i}`,
      claim: `c${i}`,
      evidence: `e${i}`,
      label: 1 as const,
    })),
    ...Array.from({ length: 50 }, (_, i) => ({
      id: `jc-n${i}`,
      claim: `c${i}`,
      evidence: `e${i}`,
      label: 0 as const,
    })),
  ];
}

const fakeScorer = async (cases: readonly JudgeCalibCase[]): Promise<Array<number | null>> =>
  cases.map((c) => (c.label === 1 ? 0.9 : 0.1));

function batch(judgeScorerMode: 'off' | 'mock' | 'http') {
  return runL1Batch({
    kbId: 'kb-1',
    retrieveMode: 'mock',
    cases: [
      { caseKey: 'a1', question: '可答题', type: 'answerable' },
      { caseKey: 'u1', question: '不可答题', type: 'unanswerable' },
    ],
    execute: async ({ caseKey }) =>
      caseKey === 'a1' ? { outcome: 'answered' } : { outcome: 'abstained' },
    judgeScorerMode,
    judgeCalibCases: calib100(),
    scoreJudge: fakeScorer,
  });
}

describe('runL1Batch · 打分器来源三态（与 api CLI 同构）', () => {
  it('声明 off（默认）→ 不跑打分器：来源 none、值为 null（即使注入了打分器）', async () => {
    const report = await batch('off');
    expect(report.judgeAurocSource).toBe('none');
    expect(report.judgeAuroc).toBeNull();
    expect(report.judgeAurocScored).toBe(0);
  });

  it('声明 mock → 内置确定性伪打分器：来源 mock、值可打印（不进判定，判定在 api 侧）', async () => {
    const report = await batch('mock');
    expect(report.judgeAurocSource).toBe('mock');
    expect(report.judgeAuroc).toBe(1);
    expect(report.judgeAurocScored).toBe(JUDGE_CALIB_MIN_CASES);
  });

  it('声明 http（live）→ 用注入的真打分器：来源 live', async () => {
    const report = await batch('http');
    expect(report.judgeAurocSource).toBe('live');
    expect(report.judgeAuroc).toBe(1);
    expect(report.judgeAurocScored).toBe(JUDGE_CALIB_MIN_CASES);
  });
});

describe('saveReport · reportJson 白名单不得静默丢键（两侧同构）', () => {
  it('报告上的每个键都在白名单里，且 judgeAurocSource 原样落库', async () => {
    const report = await batch('http');
    captured.values = undefined;

    await evalPersist.saveReport('01900000-0000-7000-8000-0000000000aa', report);

    const reportJson = captured.values?.reportJson as Record<string, unknown> | undefined;
    expect(reportJson).toBeDefined();
    expect(reportJson?.judgeAurocSource).toBe('live');

    // 逐键白名单漏一个键 → 该键在库内静默消失；本断言钉住「报告有的，库内也能看到」
    const missing = Object.keys(report).filter(
      (key) => key !== 'retrieveMode' && !(key in (reportJson ?? {})),
    );
    expect(missing).toEqual([]);
  });
});
