import { BizCode } from '@strict-rag/contracts';
import { describe, expect, it } from 'vitest';

import { extractPgError, mapPgErrorToBiz } from './pg-error.js';

describe('extractPgError', () => {
  it('reads bare { code } SQLSTATE', () => {
    expect(extractPgError({ code: '23505' })?.code).toBe('23505');
  });

  it('reads nested cause chain', () => {
    const err = {
      message: 'wrapper',
      cause: {
        message: 'mid',
        cause: { name: 'PostgresError', code: '23503' },
      },
    };
    expect(extractPgError(err)?.code).toBe('23503');
  });

  it('returns null for plain Error', () => {
    expect(extractPgError(new Error('boom'))).toBeNull();
  });

  it('does not treat Node errno codes as SQLSTATE', () => {
    expect(extractPgError({ code: 'EPERM' })).toBeNull();
    expect(extractPgError({ code: 'EPIPE' })).toBeNull();
    expect(extractPgError({ code: 'ENOENT' })).toBeNull();
  });

  it('accepts 40P01 deadlock SQLSTATE', () => {
    expect(extractPgError({ code: '40P01' })?.code).toBe('40P01');
  });

  it('caps depth', () => {
    let nested: { cause?: unknown } = { cause: { code: '23505' } };
    for (let i = 0; i < 10; i++) {
      nested = { cause: nested };
    }
    // 超过 5 层 → null
    expect(extractPgError(nested)).toBeNull();
  });
});

describe('mapPgErrorToBiz', () => {
  it('maps 23505 → CONFLICT / 409', () => {
    const m = mapPgErrorToBiz({ code: '23505' });
    expect(m.code).toBe(BizCode.CONFLICT);
    expect(m.httpStatus).toBe(409);
  });

  it('maps 23503 → CONFLICT not VALIDATION_ERROR', () => {
    const m = mapPgErrorToBiz({ code: '23503' });
    expect(m.code).toBe(BizCode.CONFLICT);
    expect(m.httpStatus).toBe(409);
  });

  it('maps 23502 / 23514 → VALIDATION_ERROR', () => {
    expect(mapPgErrorToBiz({ code: '23502' }).code).toBe(BizCode.VALIDATION_ERROR);
    expect(mapPgErrorToBiz({ code: '23514' }).code).toBe(BizCode.VALIDATION_ERROR);
  });

  it('maps 40001 / 40P01 → CONFLICT', () => {
    expect(mapPgErrorToBiz({ code: '40001' }).code).toBe(BizCode.CONFLICT);
    expect(mapPgErrorToBiz({ code: '40P01' }).code).toBe(BizCode.CONFLICT);
  });

  it('unknown / null → INTERNAL / 500', () => {
    expect(mapPgErrorToBiz({ code: '99999' }).code).toBe(BizCode.INTERNAL);
    expect(mapPgErrorToBiz(null).httpStatus).toBe(500);
  });
});
