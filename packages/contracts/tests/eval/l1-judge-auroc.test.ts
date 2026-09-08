/**
 * 目标：Judge 校准必须按 (score, label) 算 AUROC，单类或无分数不得写成 1。
 * 需求：覆盖 C3 · prds/08-quality
 * 被测：parseJudgeLabel · parseJudgeCalibration · auroc · judgeAurocFromScored
 * 简介：不用 gold type 冒充 supported；不进 2×2 / signoffEligible。
 */

import { describe, expect, it } from 'vitest';

import {
  auroc,
  judgeAurocFromScored,
  parseJudgeCalibration,
  parseJudgeLabel,
} from '../../src/eval/l1-matrix.js';

describe('parseJudgeLabel', () => {
  it('supported / 1 → 1；unsupported / 0 → 0', () => {
    expect(parseJudgeLabel('supported')).toBe(1);
    expect(parseJudgeLabel(1)).toBe(1);
    expect(parseJudgeLabel('unsupported')).toBe(0);
    expect(parseJudgeLabel(0)).toBe(0);
  });

  it('脏标签抛错', () => {
    expect(() => parseJudgeLabel('answerable')).toThrow(/judge label/);
    expect(() => parseJudgeLabel('positive')).toThrow(/judge label/);
    expect(() => parseJudgeLabel(true)).toThrow(/judge label/);
    expect(() => parseJudgeLabel(null)).toThrow(/judge label/);
    expect(() => parseJudgeLabel(2)).toThrow(/judge label/);
  });
});

describe('parseJudgeCalibration', () => {
  it('合法 cases 解析 label', () => {
    const cases = parseJudgeCalibration({
      cases: [
        { id: 'p', claim: 'c1', evidence: 'e1', label: 'supported' },
        { id: 'n', claim: 'c2', evidence: 'e2', label: 0 },
      ],
    });
    expect(cases).toHaveLength(2);
    expect(cases[0]?.label).toBe(1);
    expect(cases[1]?.label).toBe(0);
  });

  it('缺 id / claim / evidence / 空数组拒', () => {
    expect(() => parseJudgeCalibration({ cases: [] })).toThrow(/non-empty/);
    expect(() =>
      parseJudgeCalibration({ cases: [{ id: '', claim: 'c', evidence: 'e', label: 1 }] }),
    ).toThrow(/id/);
    expect(() =>
      parseJudgeCalibration({ cases: [{ id: 'x', claim: '  ', evidence: 'e', label: 1 }] }),
    ).toThrow(/claim/);
    expect(() =>
      parseJudgeCalibration({ cases: [{ id: 'x', claim: 'c', evidence: '', label: 1 }] }),
    ).toThrow(/evidence/);
  });

  it('只有一类 label → 拒', () => {
    expect(() =>
      parseJudgeCalibration({
        cases: [{ id: 'p', claim: 'c', evidence: 'e', label: 'supported' }],
      }),
    ).toThrow(/both supported and unsupported/);
  });
});

describe('auroc', () => {
  it('完美排序 → 1；倒置 → 0', () => {
    expect(
      auroc([
        { score: 0.9, label: 1 },
        { score: 0.8, label: 1 },
        { score: 0.2, label: 0 },
        { score: 0.1, label: 0 },
      ]),
    ).toBe(1);
    expect(
      auroc([
        { score: 0.1, label: 1 },
        { score: 0.9, label: 0 },
      ]),
    ).toBe(0);
  });

  it('全平局 → 0.5', () => {
    expect(
      auroc([
        { score: 0.5, label: 1 },
        { score: 0.5, label: 0 },
      ]),
    ).toBe(0.5);
  });

  it('单类 / 空 → null', () => {
    expect(auroc([{ score: 0.9, label: 1 }])).toBeNull();
    expect(auroc([{ score: 0.1, label: 0 }])).toBeNull();
    expect(auroc([])).toBeNull();
  });
});

describe('judgeAurocFromScored', () => {
  it('缺分数跳过；双侧仍在则计 AUROC', () => {
    const r = judgeAurocFromScored([
      { label: 'supported', score: 0.9 },
      { label: 'supported', score: null },
      { label: 'unsupported', score: 0.1 },
      { label: 'unsupported', score: Number.NaN },
    ]);
    expect(r.scored).toBe(2);
    expect(r.auroc).toBe(1);
  });

  it('跳过后只剩一类 → null', () => {
    const r = judgeAurocFromScored([
      { label: 1, score: 0.9 },
      { label: 0, score: null },
    ]);
    expect(r.scored).toBe(1);
    expect(r.auroc).toBeNull();
  });

  it('脏 label 仍抛，即使分数缺失', () => {
    expect(() => judgeAurocFromScored([{ label: 'answerable', score: null }])).toThrow(
      /judge label/,
    );
  });
});
