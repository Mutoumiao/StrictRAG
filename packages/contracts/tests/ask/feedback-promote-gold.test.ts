/**
 * 目标：晋升黄金集必须带题型；题面只来自当时 ask，comment 不得冒充问句。
 * 需求：ADR-019 · prds/05-api §2.6 · 功能表 §4.1
 * 被测：PatchFeedbackBodySchema · deriveGoldQuestionText · goldCaseKeyFromFeedbackId · goldRubricFromFeedbackComment
 * 简介：运营回流契约；不是 fixtures/l1/gold.yaml。
 */

import { describe, expect, it } from 'vitest';

import {
  PatchFeedbackBodySchema,
  deriveGoldQuestionText,
  goldCaseKeyFromFeedbackId,
  goldRubricFromFeedbackComment,
} from '../../src/ask/feedback.contract.js';

const FB_ID = '01900000-0000-7000-8000-0000000000c1';

describe('PatchFeedbackBodySchema', () => {
  it('promoted_to_gold 必须带 goldType', () => {
    expect(PatchFeedbackBodySchema.safeParse({ status: 'promoted_to_gold' }).success).toBe(false);
    expect(
      PatchFeedbackBodySchema.safeParse({
        status: 'promoted_to_gold',
        goldType: 'unanswerable',
      }).success,
    ).toBe(true);
  });

  it('dismissed 可不带 goldType', () => {
    expect(PatchFeedbackBodySchema.safeParse({ status: 'dismissed' }).success).toBe(true);
  });

  it('非法 goldType 拒绝', () => {
    expect(
      PatchFeedbackBodySchema.safeParse({
        status: 'promoted_to_gold',
        goldType: 'helpful',
      }).success,
    ).toBe(false);
  });
});

describe('deriveGoldQuestionText', () => {
  it('优先独立问句，否则原始问句', () => {
    expect(
      deriveGoldQuestionText({
        standaloneQuestion: ' 完整问题？ ',
        rawQuestion: '那份呢',
      }),
    ).toBe('完整问题？');
    expect(
      deriveGoldQuestionText({
        standaloneQuestion: '  ',
        rawQuestion: '住宿标准？',
      }),
    ).toBe('住宿标准？');
  });

  it('comment 不得当题面；两边空则 null', () => {
    expect(deriveGoldQuestionText({ standaloneQuestion: null, rawQuestion: '' })).toBeNull();
  });
});

describe('goldCaseKeyFromFeedbackId', () => {
  it('题号稳定为 fb-{feedbackId}', () => {
    expect(goldCaseKeyFromFeedbackId(FB_ID)).toBe(`fb-${FB_ID}`);
  });
});

describe('goldRubricFromFeedbackComment', () => {
  it('空白 comment 不写 rubric', () => {
    expect(goldRubricFromFeedbackComment('  ')).toBeNull();
    expect(goldRubricFromFeedbackComment('缺制度')).toBe('缺制度');
  });
});
