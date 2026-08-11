import { describe, expect, it } from 'vitest';

import { requireProbeKbId } from './seed-es-sparse-probe.js';

describe('requireProbeKbId', () => {
  it('returns L1_KB_ID when set', () => {
    expect(requireProbeKbId({ L1_KB_ID: ' kb-uuid ' })).toBe('kb-uuid');
  });

  it('throws exact message; does not accept PROBE_KB_ID', () => {
    expect(() => requireProbeKbId({ PROBE_KB_ID: 'x' } as NodeJS.ProcessEnv)).toThrow(
      'L1_KB_ID required',
    );
    expect(() => requireProbeKbId({})).toThrow('L1_KB_ID required');
  });
});
