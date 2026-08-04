import { describe, expect, it } from 'vitest';

import { AskOptionsSchema, AskRequestSchema, AskScopeSchema } from './ask.contract.js';
import { AskReasonSchema } from './reason.js';

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
