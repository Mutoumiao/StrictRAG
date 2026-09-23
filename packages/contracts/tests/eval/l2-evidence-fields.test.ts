/**
 * 目标：L2 的两条新判据（命中期望文档 / 合法 citation）必须同源可复核，且两侧报告字段名单只有一个锚点。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.2 · 裁定 02（一、采集面）与工单 03
 * 被测：l2CitationOk · l2CitationComplete · L2_EVIDENCE_REPORT_KEYS · L2_EVIDENCE_ROW_KEYS · hitAtKCase（L2 用法）
 * 简介：citation 三态（未下发 ≠ 无引用 ≠ 有引用）；率复用 L1 口径且不进任何判定；未映射的逻辑 id 不算命中且不抛错。
 */

import { describe, expect, it } from 'vitest';

import { hitAtKCase } from '../../src/eval/l1-matrix.js';
import {
  L2_EVIDENCE_REPORT_KEYS,
  L2_EVIDENCE_ROW_KEYS,
  l2CitationComplete,
  l2CitationOk,
} from '../../src/eval/l2-matrix.js';

describe('l2CitationOk 三态', () => {
  it('未下发 → null（不冒充 knowledge，也不算「无引用」）', () => {
    expect(l2CitationOk({})).toBeNull();
    expect(l2CitationOk({ citationCount: 0 })).toBeNull();
    expect(l2CitationOk({ answerKind: 'knowledge' })).toBeNull();
    expect(l2CitationOk({ answerKind: 'knowledge', citationCount: Number.NaN })).toBeNull();
    expect(l2CitationOk({ answerKind: undefined, citationCount: 3 })).toBeNull();
  });

  it('下发后 citations=0 → false；>0 → true', () => {
    expect(l2CitationOk({ answerKind: 'knowledge', citationCount: 0 })).toBe(false);
    expect(l2CitationOk({ answerKind: 'knowledge', citationCount: 2 })).toBe(true);
  });

  it('chitchat 行的「合法 citation」不适用 → null（不得写成 false 当引用缺失）', () => {
    expect(l2CitationOk({ answerKind: 'chitchat', citationCount: 0 })).toBeNull();
    expect(l2CitationOk({ answerKind: 'chitchat', citationCount: 3 })).toBeNull();
  });
});

describe('l2CitationComplete 复用 L1 口径', () => {
  it('分母只取 knowledge ∧ answered，错误码行不进分母', () => {
    const out = l2CitationComplete([
      { lastStatus: 'answered', answerKind: 'knowledge', citationCount: 2 },
      { lastStatus: 'answered', answerKind: 'knowledge', citationCount: 0 },
      { lastStatus: 'answered', answerKind: 'chitchat', citationCount: 0 },
      { lastStatus: 'abstained', citationCount: 0 },
      { lastStatus: undefined },
    ]);
    expect(out.citationComplete).toBe(0.5);
    expect(out.citationCompleteDen).toBe(2);
  });

  it('分母 0 → 率 null 且分母 0（该门不适用，不得写成 0）', () => {
    expect(l2CitationComplete([])).toEqual({ citationComplete: null, citationCompleteDen: 0 });
    expect(
      l2CitationComplete([
        { lastStatus: 'abstained', citationCount: 0 },
        { lastStatus: undefined },
      ]),
    ).toEqual({ citationComplete: null, citationCompleteDen: 0 });
  });

  it('knowledge ∧ answered 全带引用 → 率 1（图不变式成立时的形状）', () => {
    expect(
      l2CitationComplete([{ lastStatus: 'answered', answerKind: 'knowledge', citationCount: 1 }])
        .citationComplete,
    ).toBe(1);
  });
});

describe('两侧手抄形状的字段名单', () => {
  it('报告 7 键（含零容忍区块与可复现区块）、行 6 键，逐字锁定且无重复', () => {
    expect([...L2_EVIDENCE_REPORT_KEYS]).toEqual([
      'docHitRate',
      'docHitHits',
      'docHitScored',
      'citationComplete',
      'citationCompleteDen',
      'zeroToleranceCoverage',
      'repro',
    ]);
    expect([...L2_EVIDENCE_ROW_KEYS]).toEqual([
      'expectedDocIds',
      'evidenceDocIds',
      'docHit',
      'answerKind',
      'citationCount',
      'citationOk',
    ]);
    expect(new Set(L2_EVIDENCE_REPORT_KEYS).size).toBe(L2_EVIDENCE_REPORT_KEYS.length);
    expect(new Set(L2_EVIDENCE_ROW_KEYS).size).toBe(L2_EVIDENCE_ROW_KEYS.length);
  });
});

/**
 * 恒 0 护栏：夹具写的是逻辑 id（`l2-corpus/*`、`ingest-samples/*`），报告要比的是当前 KB 的
 * `documents.id` uuid。映射没做之前不得命中，也不得抛错 —— 未映射恒 0 是今天的正确取值。
 */
describe('逻辑 id→uuid 映射层（L2 恒 0 护栏）', () => {
  const LOGICAL_ID = 'l2-corpus/travel-stay';
  const UUID = '01900000-0000-7000-8000-0000000000d1';

  it('未映射时不算命中，也不抛错（映射缺失只降 docHitRate）', () => {
    expect(hitAtKCase([LOGICAL_ID], [UUID])).toBe(false);
    expect(hitAtKCase([UUID], [LOGICAL_ID])).toBe(false);
    expect(hitAtKCase(['l2-corpus/travel-stay', 'l2-corpus/meal-allowance'], [UUID])).toBe(false);
  });

  it('只有 trim 后逐字全等才算命中：大小写 / 前缀 / 后缀差异都不得当命中', () => {
    expect(hitAtKCase([` ${UUID} `], [UUID])).toBe(true);
    expect(hitAtKCase([` ${LOGICAL_ID} `], [LOGICAL_ID])).toBe(true);
    expect(hitAtKCase([UUID.toUpperCase()], [UUID])).toBe(false);
    expect(hitAtKCase([UUID.slice(0, 8)], [UUID])).toBe(false);
    expect(hitAtKCase([`${UUID}-v2`], [UUID])).toBe(false);
  });

  it('无标注题不计分（null），不得被当成「未命中」拉低', () => {
    expect(hitAtKCase(undefined, [UUID])).toBeNull();
    expect(hitAtKCase([], [UUID])).toBeNull();
    expect(hitAtKCase(['  '], [UUID])).toBeNull();
  });
});
