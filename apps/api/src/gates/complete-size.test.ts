import { describe, expect, it } from 'vitest';

import { BizCode } from '@strict-rag/contracts';

/** ADR-039：权威 size 闸逻辑（与 complete handler 一致） */
function assertCompleteSize(
  actualBytes: number,
  maxBytes: number,
): { ok: true } | { ok: false; code: typeof BizCode.PAYLOAD_TOO_LARGE } {
  if (actualBytes > maxBytes) {
    return { ok: false, code: BizCode.PAYLOAD_TOO_LARGE };
  }
  return { ok: true };
}

describe('complete size gate', () => {
  const max = 52_428_800; // 50 MiB

  it('accepts within limit', () => {
    expect(assertCompleteSize(1024, max)).toEqual({ ok: true });
  });

  it('rejects over limit with PRD short code', () => {
    const r = assertCompleteSize(max + 1, max);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PAYLOAD_TOO_LARGE');
  });
});