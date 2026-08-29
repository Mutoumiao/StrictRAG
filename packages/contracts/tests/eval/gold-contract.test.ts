/**
 * 目标：黄金集与评测 run DTO 必须严格字段，拒绝 τ 与空补丁。
 * 需求：prds/05-api §2.8 · 功能表 §4.1 / §5.2
 * 被测：GoldQuestionSchema · CreateGoldQuestionBodySchema · PatchGoldQuestionBodySchema · CreateEvalRunBodySchema · EvalRunSchema
 * 简介：P2 评测底线 wire 形状；不是签字包。
 */

import { describe, expect, it } from 'vitest';

import { CreateEvalRunBodySchema, EvalRunSchema } from '../../src/eval/eval-run.contract.js';
import {
  CreateGoldQuestionBodySchema,
  GoldQuestionSchema,
  PatchGoldQuestionBodySchema,
} from '../../src/eval/gold.contract.js';

describe('gold question contract', () => {
  const valid = {
    id: '01900000-0000-7000-8000-0000000000a1',
    kbId: '01900000-0000-7000-8000-0000000000b1',
    caseKey: 'g1',
    question: '差旅住宿标准？',
    type: 'answerable' as const,
  };

  it('accepts a full question and rejects extra keys', () => {
    expect(GoldQuestionSchema.parse(valid).caseKey).toBe('g1');
    expect(GoldQuestionSchema.safeParse({ ...valid, tauClaim: 0.5 }).success).toBe(false);
  });

  it('create body requires type ∈ gold types; patch empty fails', () => {
    expect(
      CreateGoldQuestionBodySchema.safeParse({
        caseKey: 'g1',
        question: 'q',
        type: 'false_premise',
      }).success,
    ).toBe(true);
    expect(CreateGoldQuestionBodySchema.safeParse({ caseKey: 'g1', question: 'q' }).success).toBe(
      false,
    );
    expect(PatchGoldQuestionBodySchema.safeParse({}).success).toBe(false);
    expect(PatchGoldQuestionBodySchema.safeParse({ question: '新题' }).success).toBe(true);
  });
});

describe('eval run contract', () => {
  it('queued create body may be empty; extra keys fail', () => {
    expect(CreateEvalRunBodySchema.safeParse({}).success).toBe(true);
    expect(CreateEvalRunBodySchema.safeParse({ maxCases: 3 }).success).toBe(true);
    expect(CreateEvalRunBodySchema.safeParse({ tauClaim: 0.2 }).success).toBe(false);
  });

  it('run DTO requires matrix and forbids unknown fields', () => {
    const run = {
      runId: '01900000-0000-7000-8000-0000000000c1',
      kbId: '01900000-0000-7000-8000-0000000000b1',
      status: 'succeeded',
      runType: 'golden_2x2',
      retrieveMode: 'mock',
      signoffEligible: false,
      caseCount: 2,
      matrix: { A: 1, B: 0, C: 0, D: 1 },
      coverage: 1,
      errorCount: 0,
      ranAt: '2026-08-29 12:00:00',
    };
    expect(EvalRunSchema.parse(run).matrix.A).toBe(1);
    expect(EvalRunSchema.safeParse({ ...run, tauClaim: 0.3 }).success).toBe(false);
  });
});
