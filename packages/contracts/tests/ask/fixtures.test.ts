/**
 * 目标：共享 answered / abstained 工厂必须能通过 AskResponseSchema，禁止夹具与契约分叉。
 * 需求：P0 R10
 * 被测：makeAnsweredFinal · makeAbstainedFinal · AskResponseSchema
 * 简介：@strict-rag/contracts/testing 工厂与响应 schema 对齐。
 */

import { describe, expect, it } from 'vitest';

import { AskResponseSchema } from '../../src/ask/ask.contract.js';
import { makeAbstainedFinal, makeAnsweredFinal } from '../../src/ask/fixtures.js';

describe('ask final fixtures (R10)', () => {
  it('R10: makeAnsweredFinal 通过 AskResponseSchema', () => {
    const r = AskResponseSchema.safeParse(makeAnsweredFinal());
    expect(r.success).toBe(true);
  });

  it('R10: makeAbstainedFinal 通过 AskResponseSchema', () => {
    const r = AskResponseSchema.safeParse(makeAbstainedFinal());
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe('abstained');
      expect(r.data.reason).toBe('low_retrieval');
    }
  });
});
