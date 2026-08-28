/**
 * 目标：KB 设置 PATCH 仅白名单且拒阈值字段，GET 必须锁定 rewrite 关闭；成员档位口不得夹带 τ。
 * 需求：B2 · 功能表 §3 问答档位
 * 被测：PatchKbSettingsBodySchema · KbSettingsSchema · AskModesSchema
 * 简介：KB 设置形状与 sessionRewrite 锁定；ask-modes 仅 allowedModes/defaultMode。
 */

import { describe, expect, it } from 'vitest';

import {
  AskModesSchema,
  KbSettingsSchema,
  PatchKbSettingsBodySchema,
} from '../../src/kb/kb-settings.contract.js';

describe('PatchKbSettingsBodySchema', () => {
  it('accepts whitelist fields', () => {
    const r = PatchKbSettingsBodySchema.safeParse({
      name: 'HR',
      description: 'desc',
      allowedModes: ['strict', 'balanced'],
      defaultMode: 'strict',
    });
    expect(r.success).toBe(true);
  });

  it('rejects empty body', () => {
    expect(PatchKbSettingsBodySchema.safeParse({}).success).toBe(false);
  });

  it('rejects tauClaim (strict)', () => {
    const r = PatchKbSettingsBodySchema.safeParse({ name: 'x', tauClaim: 0.1 });
    expect(r.success).toBe(false);
  });

  it('rejects allowDegradedGenerate', () => {
    const r = PatchKbSettingsBodySchema.safeParse({
      name: 'x',
      allowDegradedGenerate: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects sessionRewriteEnabledDefault', () => {
    const r = PatchKbSettingsBodySchema.safeParse({
      sessionRewriteEnabledDefault: true,
    });
    expect(r.success).toBe(false);
  });

  it('rejects cragOk', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ cragOk: 0.9 }).success).toBe(false);
  });

  it('rejects duplicate allowedModes', () => {
    expect(
      PatchKbSettingsBodySchema.safeParse({
        allowedModes: ['strict', 'strict'],
      }).success,
    ).toBe(false);
  });

  it('accepts dataClass whitelist values', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ dataClass: 'internal' }).success).toBe(true);
    expect(PatchKbSettingsBodySchema.safeParse({ dataClass: 'sensitive' }).success).toBe(true);
  });

  it('rejects invalid dataClass', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ dataClass: 'public' }).success).toBe(false);
    expect(PatchKbSettingsBodySchema.safeParse({ dataClass: 'secret' }).success).toBe(false);
  });

  it('accepts deptInheritDown true/false', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ deptInheritDown: true }).success).toBe(true);
    expect(PatchKbSettingsBodySchema.safeParse({ deptInheritDown: false }).success).toBe(true);
  });

  it('rejects invalid deptInheritDown', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ deptInheritDown: 'false' }).success).toBe(false);
    expect(PatchKbSettingsBodySchema.safeParse({ deptInheritDown: 1 }).success).toBe(false);
    expect(PatchKbSettingsBodySchema.safeParse({ deptInheritDown: null }).success).toBe(false);
  });

  it('accepts deptAclEnforce true/false', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ deptAclEnforce: true }).success).toBe(true);
    expect(PatchKbSettingsBodySchema.safeParse({ deptAclEnforce: false }).success).toBe(true);
  });

  it('rejects invalid deptAclEnforce', () => {
    expect(PatchKbSettingsBodySchema.safeParse({ deptAclEnforce: 'false' }).success).toBe(false);
    expect(PatchKbSettingsBodySchema.safeParse({ deptAclEnforce: 1 }).success).toBe(false);
    expect(PatchKbSettingsBodySchema.safeParse({ deptAclEnforce: null }).success).toBe(false);
  });
});

describe('KbSettingsSchema', () => {
  it('requires sessionRewrite locked off', () => {
    const base = {
      kbId: '01900000-0000-7000-8000-000000000099',
      name: 'KB',
      allowedModes: ['balanced'] as const,
      defaultMode: 'balanced' as const,
      qualitySnapshot: { tauClaim: 0.5 },
    };
    expect(
      KbSettingsSchema.safeParse({
        ...base,
        sessionRewrite: { enabledDefault: false, locked: true },
      }).success,
    ).toBe(true);
    expect(
      KbSettingsSchema.safeParse({
        ...base,
        sessionRewrite: { enabledDefault: true, locked: false },
      }).success,
    ).toBe(false);
  });

  it('defaults dataClass to internal when omitted', () => {
    const r = KbSettingsSchema.safeParse({
      kbId: '01900000-0000-7000-8000-000000000099',
      name: 'KB',
      allowedModes: ['balanced'] as const,
      defaultMode: 'balanced' as const,
      qualitySnapshot: { tauClaim: 0.5 },
      sessionRewrite: { enabledDefault: false, locked: true },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.dataClass).toBe('internal');
  });

  it('defaults deptInheritDown to true when omitted (old GET row)', () => {
    const r = KbSettingsSchema.safeParse({
      kbId: '01900000-0000-7000-8000-000000000099',
      name: 'KB',
      allowedModes: ['balanced'] as const,
      defaultMode: 'balanced' as const,
      qualitySnapshot: { tauClaim: 0.5 },
      sessionRewrite: { enabledDefault: false, locked: true },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deptInheritDown).toBe(true);
  });

  it('defaults deptAclEnforce to false when omitted (old GET row)', () => {
    const r = KbSettingsSchema.safeParse({
      kbId: '01900000-0000-7000-8000-000000000099',
      name: 'KB',
      allowedModes: ['balanced'] as const,
      defaultMode: 'balanced' as const,
      qualitySnapshot: { tauClaim: 0.5 },
      sessionRewrite: { enabledDefault: false, locked: true },
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.deptAclEnforce).toBe(false);
  });
});

describe('AskModesSchema', () => {
  it('accepts allowedModes + defaultMode', () => {
    const r = AskModesSchema.safeParse({
      allowedModes: ['strict', 'balanced'],
      defaultMode: 'balanced',
    });
    expect(r.success).toBe(true);
  });

  it('rejects tauClaim / extra keys / default not in allowed', () => {
    expect(
      AskModesSchema.safeParse({
        allowedModes: ['balanced'],
        defaultMode: 'balanced',
        tauClaim: 0.3,
      }).success,
    ).toBe(false);
    expect(
      AskModesSchema.safeParse({
        allowedModes: ['balanced'],
        defaultMode: 'fast',
      }).success,
    ).toBe(false);
    expect(
      AskModesSchema.safeParse({
        allowedModes: ['strict', 'strict'],
        defaultMode: 'strict',
      }).success,
    ).toBe(false);
  });
});
