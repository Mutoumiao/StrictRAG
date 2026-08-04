import { describe, expect, it } from 'vitest';

import { checkUploadByteSize } from './upload-size.js';

describe('checkUploadByteSize (ADR-039, shared with complete route)', () => {
  const max = 52_428_800; // 50 MiB

  it('accepts within limit', () => {
    expect(checkUploadByteSize(1024, max)).toEqual({ ok: true });
    expect(checkUploadByteSize(max, max)).toEqual({ ok: true });
  });

  it('rejects over limit with PRD short code', () => {
    const r = checkUploadByteSize(max + 1, max);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
