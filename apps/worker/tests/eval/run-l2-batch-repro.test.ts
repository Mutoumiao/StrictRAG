/**
 * 目标：worker L2 批跑必须与 api CLI 落同形状的 PRD §8 可复现区块（剧本集哈希取真值、两个版本键恒 null），且落库白名单不得把它静默丢弃。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §8 可复现字段 · 裁定 02（三、§8 的 L2 侧字段）与工单 05
 * 被测：runL2Batch · evalPersist.saveL2Report（reportJson 逐键白名单）
 * 简介：区块键集 = contracts `emptyL2Repro()` 同形状；哈希按本跑 case id 集合算（重排同值、改一个 id 即变）；白名单保留 repro。
 */

import { describe, expect, it, vi } from 'vitest';

import { emptyL2Repro, l2GoldSetHash } from '@strict-rag/contracts/eval-repro-l2';
import type { L2Case } from '@strict-rag/contracts';

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

const IDS = ['l2-near-coref-001', 'l2-budget-001', 'l2-adversarial-001'];

function l2Case(id: string): L2Case {
  return {
    id,
    type: 'near_coref',
    turns: [
      { role: 'user', text: `${id}-1`, session: 'same' },
      { role: 'user', text: `${id}-2`, session: 'same' },
    ],
    expected: { themePersist: true, historyInEvidence: false, rewriteUsed: false, accept: ['answered'] },
    rubric: 'r',
  };
}

function batch(caseIds: readonly string[]) {
  return runL2Batch({
    kbId: 'kb',
    retrieveMode: 'live',
    cases: caseIds.map(l2Case),
    executeTurn: async () => ({
      outcome: 'answered',
      rewriteUsed: false,
      evidenceTexts: ['条款'],
      evidenceDocIds: [],
      answer: 'ok',
    }),
  });
}

describe('runL2Batch · §8 可复现区块', () => {
  it('区块与 api 侧同形状（键集 = contracts emptyL2Repro），哈希取真值', async () => {
    const report = await batch(IDS);

    expect(Object.keys(report.repro).sort()).toEqual(Object.keys(emptyL2Repro()).sort());
    expect(report.repro.l2GoldSetHash).toBe(l2GoldSetHash(IDS));
    expect(report.repro.l2GoldSetHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('两个版本键恒 null（无载体即记债，不给伪版本）', async () => {
    const report = await batch(IDS);
    expect(report.repro.sessionStrategyVersion).toBeNull();
    expect(report.repro.rewritePromptVersion).toBeNull();

    const serialized = JSON.stringify(report.repro);
    for (const fake of ['"unknown"', '"-"', '""', '"n/a"', '"v0"']) {
      expect(serialized).not.toContain(fake);
    }
  });

  it('反证：题面集重排 → 哈希不变；改一个 case id 即变', async () => {
    const forward = await batch(IDS);
    const reversed = await batch([...IDS].reverse());
    expect(reversed.repro.l2GoldSetHash).toBe(forward.repro.l2GoldSetHash);

    const mutated = await batch(['l2-near-coref-001', 'l2-budget-002', 'l2-adversarial-001']);
    expect(mutated.repro.l2GoldSetHash).not.toBe(forward.repro.l2GoldSetHash);
  });

  it('区块不进判定：工程 signoffEligible 的合取项里没有它（区块存在也不改判）', async () => {
    const report = await batch(IDS);
    // 3 题 < 15 → 规模门本就 false；区块的存在不参与该式（无 repro 时逐位同值）
    expect(report.caseCount).toBe(3);
    expect(report.signoffEligible).toBe(false);
    expect(report.repro).not.toHaveProperty('signoffEligible');
  });
});

describe('saveL2Report · reportJson 白名单不得静默丢 repro', () => {
  it('落库 JSON 保留 repro，且报告上的每个键都在白名单里', async () => {
    const report = await batch(IDS);
    captured.values = undefined;

    await evalPersist.saveL2Report('01900000-0000-7000-8000-0000000000aa', report);

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
