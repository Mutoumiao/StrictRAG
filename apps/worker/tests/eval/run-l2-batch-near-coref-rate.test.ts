/**
 * 目标：worker L2 批跑必须把 near_coref 机械 pass 比例落进报告，并真进工程 signoffEligible。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 :188（近指代主题正确且合法作答 ≥80%）
 * 被测：runL2Batch
 * 简介：注入 executeTurn；分母只取 near_coref 且含 error（全 error → 0%，不放行）；非 near_coref 题不影响该率。
 */

import { describe, expect, it } from 'vitest';

import { L2_TYPES, type L2Case, type L2Type } from '@strict-rag/contracts';

import { runL2Batch } from '../../src/eval/run-l2-batch.js';

function l2Case(id: string, type: L2Type): L2Case {
  return {
    id,
    type,
    turns: [
      { role: 'user', text: `${id}-1`, session: 'same' },
      { role: 'user', text: `${id}-2`, session: 'same' },
    ],
    expected: {
      themePersist: true,
      historyInEvidence: false,
      rewriteUsed: false,
      accept: ['answered'],
    },
    rubric: 'r',
  };
}

/** 九类必含；另加 extraNearCoref 条 near_coref，再补齐到 15 题 */
function casesFor(extraNearCoref: number): L2Case[] {
  const cases = L2_TYPES.map((type, i) => l2Case(`l2-t-${String(i).padStart(3, '0')}`, type));
  for (let i = 0; i < extraNearCoref; i++) {
    cases.push(l2Case(`l2-n-${i}`, 'near_coref'));
  }
  let fill = 0;
  while (cases.length < 15) {
    cases.push(l2Case(`l2-f-${String(fill++).padStart(3, '0')}`, 'budget'));
  }
  return cases;
}

const okTurn = () => ({
  outcome: 'answered' as const,
  rewriteUsed: false,
  evidenceTexts: [],
  answer: 'ok',
});

describe('runL2Batch 近指代通过率', () => {
  it('5 条 near_coref、4 pass 1 fail = 恰好 80% → 率 0.8、分母 5 且工程 signoffEligible', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: casesFor(4),
      executeTurn: async ({ question }) =>
        question.includes('l2-n-3') ? { outcome: 'abstained', answer: 'no' } : okTurn(),
    });
    expect(report.nearCorefPassDen).toBe(5);
    expect(report.nearCorefPassRate).toBe(0.8);
    expect(report.caseCount).toBe(15);
    expect(report.zeroToleranceHits).toBe(0);
    expect(report.signoffEligible).toBe(true);
  });

  it('near_coref 全 error → 率 0（error 进分母）→ 不放行', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: casesFor(6),
      executeTurn: async ({ question }) => {
        if (question.includes('l2-n-') || question.includes('l2-t-000')) {
          throw new Error('gateway down');
        }
        return okTurn();
      },
    });
    expect(report.nearCorefPassDen).toBe(7);
    expect(report.nearCorefPassRate).toBe(0);
    expect(report.zeroToleranceHits).toBe(0);
    expect(report.caseCount).toBe(15);
    expect(report.signoffEligible).toBe(false);
  });

  it('分母只取 near_coref：其它类全 fail 也不压该率', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-nc-1', 'near_coref'), l2Case('l2-ts-1', 'topic_switch')],
      executeTurn: async ({ question }) =>
        question.includes('l2-ts-1') ? { outcome: 'abstained', answer: 'no' } : okTurn(),
    });
    expect(report.nearCorefPassDen).toBe(1);
    expect(report.nearCorefPassRate).toBe(1);
    expect(report.failCount).toBe(1);
  });
});
