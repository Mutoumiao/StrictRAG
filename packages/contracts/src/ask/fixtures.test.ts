import { describe, expect, it } from 'vitest';

import { AskResponseSchema } from './ask.contract.js';
import { makeAbstainedFinal, makeAnsweredFinal } from './fixtures.js';

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
