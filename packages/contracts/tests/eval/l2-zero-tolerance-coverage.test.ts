/**
 * 目标：PRD §6.2 四项零容忍的处置档位区块必须逐条如实（1 处机械判 + 4 处记债），可被反证推翻。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · 裁定 02（二、零容忍四项 / 裁定 4 · 5 · 6）
 * 被测：l2ZeroToleranceCoverage · L2_ZERO_TOLERANCE_ITEM_KEYS · L2_ZERO_TOLERANCE_PLACE_KEYS
 * 简介：四项逐条取值钉死；「历史文本进 evidence/min_support」一项如实摊成两处（一处机械判、一处记债）；
 *       命中数与入参同源；非法命中数抛错（不许静默当 0）；任一 debt 处被伪改成 mechanical 即红。
 */

import { describe, expect, it } from 'vitest';

import {
  L2_EVIDENCE_REPORT_KEYS,
  L2_ZERO_TOLERANCE_ITEM_KEYS,
  L2_ZERO_TOLERANCE_PLACE_KEYS,
  l2ZeroToleranceCoverage,
  type L2ZeroTolerancePlace,
} from '../../src/eval/l2-matrix.js';

function placesOf(hits: number): L2ZeroTolerancePlace[] {
  return l2ZeroToleranceCoverage(hits).flatMap((item) => item.places);
}

function placeOf(hits: number, key: string): L2ZeroTolerancePlace | undefined {
  return placesOf(hits).find((p) => p.key === key);
}

describe('l2ZeroToleranceCoverage 四项逐条', () => {
  it('四项 = PRD 原句顺序；今天整项档位全为 debt（无一项已被全覆盖）', () => {
    const cov = l2ZeroToleranceCoverage(0);
    expect(cov.map((i) => i.key)).toEqual([...L2_ZERO_TOLERANCE_ITEM_KEYS]);
    expect(cov.map((i) => i.judged)).toEqual(['debt', 'debt', 'debt', 'debt']);
    expect(['topicStickiness', 'historyText', 'kbConflictNumber', 'skipVerify']).toEqual([
      ...L2_ZERO_TOLERANCE_ITEM_KEYS,
    ]);
  });

  it('去处 = 5 处（历史文本那项点两处），只有 historyInEvidence 是 mechanical', () => {
    const places = placesOf(0);
    expect(places.map((p) => p.key)).toEqual([...L2_ZERO_TOLERANCE_PLACE_KEYS]);
    expect(places.map((p) => p.judged)).toEqual(['debt', 'mechanical', 'debt', 'debt', 'debt']);
    expect(places.filter((p) => p.judged === 'mechanical').map((p) => p.key)).toEqual([
      'historyInEvidence',
    ]);
  });

  it('「历史文本进 evidence/min_support」一项不许含糊成一行：原句写全两处、档位一机一债', () => {
    const item = l2ZeroToleranceCoverage(0).find((i) => i.key === 'historyText');
    expect(item?.prd).toContain('evidence');
    expect(item?.prd).toContain('min_support');
    expect(item?.places.map((p) => p.judged)).toEqual(['mechanical', 'debt']);
    expect(item?.judged).toBe('debt');
  });

  it('每处带一句话说明（判的是什么 / 为何记债），不得为空', () => {
    for (const p of placesOf(0)) {
      expect(p.note.trim().length).toBeGreaterThan(8);
    }
  });
});

describe('命中数与 zeroToleranceHits 同源', () => {
  it('historyInEvidence.hits 等于入参（同源计数，不许在本区块里另算一份）', () => {
    for (const hits of [0, 1, 2, 7]) {
      expect(placeOf(hits, 'historyInEvidence')?.hits).toBe(hits);
    }
  });

  it('debt 处的 hits 一律 null：不许拿 0 冒充「该项已判且满足」', () => {
    for (const hits of [0, 3]) {
      for (const p of placesOf(hits)) {
        if (p.key === 'historyInEvidence') continue;
        expect(p.judged).toBe('debt');
        expect(p.hits).toBeNull();
      }
    }
  });

  it('非法命中数抛错，不许静默当 0 变成「零容忍全清白」', () => {
    expect(() => l2ZeroToleranceCoverage(Number.NaN)).toThrow(TypeError);
    expect(() => l2ZeroToleranceCoverage(-1)).toThrow(TypeError);
    expect(() => l2ZeroToleranceCoverage(Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe('反证：伪造 mechanical 即红', () => {
  it('唯一 mechanical 处必须带同源命中数；整项档位必须随去处走（半判半债不得写 mechanical）', () => {
    const cov = l2ZeroToleranceCoverage(2);
    const mech = cov.flatMap((i) => i.places).filter((p) => p.judged === 'mechanical');
    expect(mech.map((p) => p.key)).toEqual(['historyInEvidence']);
    expect(mech.every((p) => p.hits === 2)).toBe(true);

    for (const item of cov) {
      const allMechanical = item.places.every((p) => p.judged === 'mechanical');
      expect(item.judged).toBe(allMechanical ? 'mechanical' : 'debt');
    }
  });
});

describe('区块进两侧同构名单', () => {
  it('zeroToleranceCoverage 在 L2_EVIDENCE_REPORT_KEYS 里（worker 白名单锚点同源）', () => {
    expect([...L2_EVIDENCE_REPORT_KEYS]).toContain('zeroToleranceCoverage');
  });
});
