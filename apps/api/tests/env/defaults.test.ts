/**
 * 目标：api env 默认值保持关闭态，tauClaim 双源冲突必须拒绝。
 * 需求：基建: api env Zod
 * 被测：env Zod 对齐（不启动进程）
 * 简介：rewrite / AUTH_ENFORCE 默认关；ask/ingest RPM 默认 0。
 */

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

/** 与 env.ts 中 SESSION_REWRITE_ENABLED 对齐（dogfood 可 true；默认 false） */
const RewriteSchema = z.object({
  SESSION_REWRITE_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

/** 与 env.ts 中 AUTH_ENFORCE 对齐（禁止仓库默认改 true） */
const AuthEnforceSchema = z.object({
  AUTH_ENFORCE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

describe('SESSION_REWRITE_ENABLED (U8 dogfood)', () => {
  it('default / omitted → false', () => {
    const r = RewriteSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.SESSION_REWRITE_ENABLED).toBe(false);
  });
  it('explicit false → false', () => {
    const r = RewriteSchema.safeParse({ SESSION_REWRITE_ENABLED: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.SESSION_REWRITE_ENABLED).toBe(false);
  });
  it('true parses successfully (dogfood)', () => {
    const r = RewriteSchema.safeParse({ SESSION_REWRITE_ENABLED: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.SESSION_REWRITE_ENABLED).toBe(true);
  });
});

describe('AUTH_ENFORCE default stays false', () => {
  it('default / omitted → false', () => {
    const r = AuthEnforceSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.AUTH_ENFORCE).toBe(false);
  });
  it('explicit false → false', () => {
    const r = AuthEnforceSchema.safeParse({ AUTH_ENFORCE: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.AUTH_ENFORCE).toBe(false);
  });
});

/** 与 env.ts 中 DEPT_ACL_ENFORCE 对齐（禁止仓库默认改 true） */
const DeptAclEnforceSchema = z.object({
  DEPT_ACL_ENFORCE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

describe('DEPT_ACL_ENFORCE default stays false', () => {
  it('default / omitted → false', () => {
    const r = DeptAclEnforceSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.DEPT_ACL_ENFORCE).toBe(false);
  });
  it('explicit false → false', () => {
    const r = DeptAclEnforceSchema.safeParse({ DEPT_ACL_ENFORCE: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.DEPT_ACL_ENFORCE).toBe(false);
  });
  it('true parses (opt-in)', () => {
    const r = DeptAclEnforceSchema.safeParse({ DEPT_ACL_ENFORCE: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.DEPT_ACL_ENFORCE).toBe(true);
  });
});

/** 与 env.ts 中 DEPT_INHERIT_DOWN 对齐（禁止仓库默认改 false） */
const DeptInheritDownSchema = z.object({
  DEPT_INHERIT_DOWN: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

describe('DEPT_INHERIT_DOWN default stays true', () => {
  it('default / omitted → true', () => {
    const r = DeptInheritDownSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.DEPT_INHERIT_DOWN).toBe(true);
  });
  it('explicit true → true', () => {
    const r = DeptInheritDownSchema.safeParse({ DEPT_INHERIT_DOWN: 'true' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.DEPT_INHERIT_DOWN).toBe(true);
  });
  it('false parses (opt-out ancestor)', () => {
    const r = DeptInheritDownSchema.safeParse({ DEPT_INHERIT_DOWN: 'false' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.DEPT_INHERIT_DOWN).toBe(false);
  });
});

/** 与 env.ts 中 ASK/INGEST RPM 对齐（禁止仓库默认改正数） */
const QuotaRpmSchema = z.object({
  ASK_RATE_LIMIT_RPM: z.coerce.number().int().min(0).default(0),
  INGEST_RATE_LIMIT_RPM: z.coerce.number().int().min(0).default(0),
});

describe('ask/ingest RPM default stays 0', () => {
  it('default / omitted → 0', () => {
    const r = QuotaRpmSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ASK_RATE_LIMIT_RPM).toBe(0);
      expect(r.data.INGEST_RATE_LIMIT_RPM).toBe(0);
    }
  });
});

/** 与 env.ts 中上传上限对齐（功能表 §5.2「MD/TXT 可更严」；族级不得比通用更宽） */
const UploadSizeSchema = z
  .object({
    INGEST_MAX_FILE_BYTES: z.coerce.number().int().positive().default(52_428_800),
    INGEST_MAX_FILE_BYTES_CEILING: z.coerce.number().int().positive().default(209_715_200),
    INGEST_MAX_TEXT_FILE_BYTES: z.coerce.number().int().nonnegative().default(10_485_760),
  })
  .superRefine((data, ctx) => {
    if (
      data.INGEST_MAX_TEXT_FILE_BYTES > 0 &&
      data.INGEST_MAX_TEXT_FILE_BYTES > data.INGEST_MAX_FILE_BYTES
    ) {
      ctx.addIssue({ code: 'custom', path: ['INGEST_MAX_TEXT_FILE_BYTES'], message: '族级更宽' });
    }
  });

describe('上传上限：通用 / 天花板 / 文本族', () => {
  it('默认 50 MiB / 200 MiB / 10 MiB', () => {
    const r = UploadSizeSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.INGEST_MAX_FILE_BYTES).toBe(52_428_800);
      expect(r.data.INGEST_MAX_FILE_BYTES_CEILING).toBe(209_715_200);
      expect(r.data.INGEST_MAX_TEXT_FILE_BYTES).toBe(10_485_760);
    }
  });

  it('族级 0 = 关闭族级档，合法', () => {
    const r = UploadSizeSchema.safeParse({ INGEST_MAX_TEXT_FILE_BYTES: '0' });
    expect(r.success).toBe(true);
  });

  it('族级比通用更宽 → 启动即拒（不静默取 min）', () => {
    expect(
      UploadSizeSchema.safeParse({
        INGEST_MAX_FILE_BYTES: '1048576',
        INGEST_MAX_TEXT_FILE_BYTES: '20971520',
      }).success,
    ).toBe(false);
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
