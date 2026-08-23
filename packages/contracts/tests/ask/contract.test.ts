/**
 * 目标：AskOptions 只接受白名单字段，拒绝 tauClaim 与嵌套 scope，scope 必须顶层。
 * 需求：ADR-050 · prds/05-api §1.1
 * 被测：AskOptionsSchema · AskScopeSchema · AskRequestSchema · AskReasonSchema · CreateFeedbackBodySchema · InviteMemberBodySchema
 * 简介：Ask 请求 / options / scope 形状 SSOT。
 */

import { describe, expect, it } from 'vitest';

import { AskOptionsSchema, AskRequestSchema, AskScopeSchema } from '../../src/ask/ask.contract.js';
import { AskReasonSchema } from '../../src/ask/reason.js';

describe('AskOptionsSchema', () => {
  it('accepts whitelist fields only', () => {
    const r = AskOptionsSchema.safeParse({
      stream: true,
      debug: false,
      mode: 'balanced',
      locale: 'zh-CN',
    });
    expect(r.success).toBe(true);
  });

  it('rejects tauClaim in options', () => {
    const r = AskOptionsSchema.safeParse({ stream: true, tauClaim: 0.5 });
    expect(r.success).toBe(false);
  });

  it('rejects scope nested in options', () => {
    const r = AskOptionsSchema.safeParse({
      stream: true,
      scope: { docTypes: ['hr'] },
    });
    expect(r.success).toBe(false);
  });

  it('rejects retrieveK', () => {
    const r = AskOptionsSchema.safeParse({ retrieveK: 10 });
    expect(r.success).toBe(false);
  });
});

describe('AskScopeSchema', () => {
  it('accepts docTypes top-level shape', () => {
    const r = AskScopeSchema.safeParse({ docTypes: ['hr'] });
    expect(r.success).toBe(true);
  });

  it('rejects unknown keys', () => {
    const r = AskScopeSchema.safeParse({ docTypes: ['hr'], tauClaim: 0.1 });
    expect(r.success).toBe(false);
  });
});

describe('AskRequestSchema', () => {
  it('accepts scope top-level with options whitelist', () => {
    const r = AskRequestSchema.safeParse({
      question: '差旅住宿标准？',
      sessionId: null,
      scope: { docTypes: ['hr'] },
      options: { stream: false, mode: 'balanced' },
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty question', () => {
    const r = AskRequestSchema.safeParse({ question: '' });
    expect(r.success).toBe(false);
  });

  it('rejects top-level tauClaim (strict root)', () => {
    const r = AskRequestSchema.safeParse({ question: 'x', tauClaim: 0.1 });
    expect(r.success).toBe(false);
  });

  it('rejects invalid mode turbo', () => {
    const r = AskOptionsSchema.safeParse({ mode: 'turbo' });
    expect(r.success).toBe(false);
  });
});

describe('AskReasonSchema', () => {
  it('includes P2 hard reasons', () => {
    for (const code of [
      'budget_exhausted',
      'rerank_unavailable',
      'coref_unresolved',
      'claim_split_failed',
    ] as const) {
      expect(AskReasonSchema.safeParse(code).success).toBe(true);
    }
  });
});

describe('CreateFeedbackBodySchema / InviteMemberBodySchema', () => {
  it('feedback 至少 rating/category/comment 之一', async () => {
    const { CreateFeedbackBodySchema } = await import('../../src/ask/feedback.contract.js');
    expect(CreateFeedbackBodySchema.safeParse({ requestId: 'r1' }).success).toBe(false);
    expect(
      CreateFeedbackBodySchema.safeParse({ requestId: 'r1', rating: 'up' }).success,
    ).toBe(true);
  });

  it('invite 须 userId 或 email', async () => {
    const { InviteMemberBodySchema } = await import('../../src/ask/member.contract.js');
    expect(InviteMemberBodySchema.safeParse({ role: 'read' }).success).toBe(false);
    expect(
      InviteMemberBodySchema.safeParse({ email: 'a@b.com', role: 'read' }).success,
    ).toBe(true);
  });
});
