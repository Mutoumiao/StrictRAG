import { describe, expect, it } from 'vitest';
import { z } from 'zod';

/**
 * tauClaim 唯一源规则（与 env.ts superRefine 对齐，不启动进程）。
 */
const TauSchema = z
  .object({
    TAU_CLAIM: z.coerce.number().min(0).max(1),
    TAU_CLAIM_LEGACY: z.coerce.number().min(0).max(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.TAU_CLAIM_LEGACY !== undefined && data.TAU_CLAIM_LEGACY !== data.TAU_CLAIM) {
      ctx.addIssue({
        code: 'custom',
        path: ['TAU_CLAIM'],
        message: 'tauClaim 双源冲突',
      });
    }
  });

/** 与 env.ts 中 SESSION_REWRITE_ENABLED superRefine 对齐 */
const RewriteSchema = z
  .object({
    SESSION_REWRITE_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((data, ctx) => {
    if (data.SESSION_REWRITE_ENABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_REWRITE_ENABLED'],
        message: 'P2 禁止 SESSION_REWRITE_ENABLED=true',
      });
    }
  });

describe('SESSION_REWRITE_ENABLED P2 gate (U8)', () => {
  it('default false ok', () => {
    expect(RewriteSchema.safeParse({}).success).toBe(true);
  });
  it('true rejected', () => {
    expect(RewriteSchema.safeParse({ SESSION_REWRITE_ENABLED: 'true' }).success).toBe(false);
  });
});

describe('tauClaim unique source', () => {
  it('accepts single TAU_CLAIM', () => {
    const r = TauSchema.safeParse({ TAU_CLAIM: '0.5' });
    expect(r.success).toBe(true);
  });

  it('rejects conflicting legacy source', () => {
    const r = TauSchema.safeParse({ TAU_CLAIM: 0.5, TAU_CLAIM_LEGACY: 0.8 });
    expect(r.success).toBe(false);
  });

  it('allows legacy equal to primary', () => {
    const r = TauSchema.safeParse({ TAU_CLAIM: 0.5, TAU_CLAIM_LEGACY: 0.5 });
    expect(r.success).toBe(true);
  });
});
