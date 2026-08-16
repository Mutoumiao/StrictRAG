import { describe, expect, it } from 'vitest';

import {
  KbSettingsSchema,
  PatchKbSettingsBodySchema,
} from './kb-settings.contract.js';

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
});
