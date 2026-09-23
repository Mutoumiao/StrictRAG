/**
 * 目标：worker L2 报告必须与 api CLI 同构地落零容忍处置档位区块，落库白名单不得静默丢弃该区块。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · 裁定 02（二、零容忍四项 / 裁定 4 · 5 · 6）
 * 被测：runL2Batch · evalPersist.saveL2Report（reportJson 白名单）
 * 简介：注入 executeTurn；mechanical 处命中数与整批 zeroToleranceHits 同源（两题泄漏即 2）；
 *       其余四处一律 debt 且 hits 为 null；捕获 set 载荷证明白名单逐键保留该区块。
 */

import {
  L2_TYPES,
  L2_ZERO_TOLERANCE_ITEM_KEYS,
  L2_ZERO_TOLERANCE_PLACE_KEYS,
  type L2Case,
  type L2Type,
} from '@strict-rag/contracts';
import { describe, expect, it, vi } from 'vitest';

/** saveL2Report 写入的 set 载荷（不连真 PG） */
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

const { runL2Batch } = await import('../../src/eval/run-l2-batch.js');
const { evalPersist } = await import('../../src/eval/persist.js');

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

/** 末轮 evidence 正文复现首轮问句原文 → historyLeaked 命中；leak=false 时干净 */
const turn = (leak: boolean) =>
  async ({ question }: { question: string }) => ({
    outcome: 'answered' as const,
    rewriteUsed: false,
    evidenceTexts: leak && question.endsWith('-2') ? [question.slice(0, -2) + '-1'] : ['条款'],
    answer: 'ok',
  });

describe('runL2Batch 零容忍处置区块', () => {
  it('两题泄漏 → 区块命中数 = 整批 zeroToleranceHits = 2，其余四处 debt/null', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-zt-a', 'near_coref'), l2Case('l2-zt-b', 'near_coref')],
      executeTurn: turn(true),
    });

    expect(report.zeroToleranceHits).toBe(2);
    const places = report.zeroToleranceCoverage.flatMap((i) => i.places);
    expect(places.map((p) => p.key)).toEqual([...L2_ZERO_TOLERANCE_PLACE_KEYS]);
    expect(report.zeroToleranceCoverage.map((i) => i.key)).toEqual([
      ...L2_ZERO_TOLERANCE_ITEM_KEYS,
    ]);
    expect(report.zeroToleranceCoverage.map((i) => i.judged)).toEqual([
      'debt',
      'debt',
      'debt',
      'debt',
    ]);
    const hit = places.find((p) => p.key === 'historyInEvidence');
    expect(hit?.judged).toBe('mechanical');
    expect(hit?.hits).toBe(report.zeroToleranceHits);
    expect(hit?.hits).toBe(2);
    for (const p of places) {
      if (p.key === 'historyInEvidence') continue;
      expect(p.judged).toBe('debt');
      expect(p.hits).toBeNull();
    }
  });

  it('零泄漏 → 命中数 0 且四项仍逐条如实（记债不进判定，工程公式不受影响）', async () => {
    const cases: L2Case[] = L2_TYPES.map((type, i) =>
      l2Case(`l2-zt-t-${String(i).padStart(3, '0')}`, type),
    );
    while (cases.length < 15) {
      cases.push(l2Case(`l2-zt-f-${String(cases.length).padStart(3, '0')}`, 'near_coref'));
    }
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases,
      executeTurn: turn(false),
    });

    expect(report.zeroToleranceHits).toBe(0);
    const places = report.zeroToleranceCoverage.flatMap((i) => i.places);
    expect(places.find((p) => p.key === 'historyInEvidence')?.hits).toBe(0);
    expect(places.filter((p) => p.judged === 'debt')).toHaveLength(4);
    expect(report.caseCount).toBeGreaterThanOrEqual(15);
    expect(report.signoffEligible).toBe(true);
  });
});

describe('saveL2Report · 白名单不得静默丢零容忍区块', () => {
  it('落库 JSON 保留 zeroToleranceCoverage，且与报告逐位相等', async () => {
    const report = await runL2Batch({
      kbId: 'kb',
      retrieveMode: 'live',
      cases: [l2Case('l2-zt-p', 'near_coref')],
      executeTurn: turn(true),
    });
    expect(report.zeroToleranceHits).toBe(1);
    captured.values = undefined;

    await evalPersist.saveL2Report('01900000-0000-7000-8000-0000000000aa', report);

    const reportJson = captured.values?.reportJson as Record<string, unknown> | undefined;
    expect(reportJson).toHaveProperty('zeroToleranceCoverage');
    expect(reportJson?.zeroToleranceCoverage).toEqual(report.zeroToleranceCoverage);
    // 逐键白名单漏一个键 → 该键在库内静默消失
    const missing = Object.keys(report).filter(
      (key) => key !== 'retrieveMode' && !(key in (reportJson ?? {})),
    );
    expect(missing).toEqual([]);
  });
});
