/**
 * 目标：稀疏探针脚本在缺少 KB 时必须拒绝误跑。
 * 需求：OPS-1
 * 被测：requireProbeKbId
 * 简介：非生产 ES 宣称。
 */

import { describe, expect, it } from 'vitest';

import { requireProbeKbId } from '../../src/scripts/seed-es-sparse-probe.js';

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
