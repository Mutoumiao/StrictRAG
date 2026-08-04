import { describe, expect, it } from 'vitest';

/**
 * 文档门禁纯函数（与 routes/documents 业务闸对齐，不启服不连库）。
 * 权威：ADR-039 size · ADR-048 先批后扫 · dual-ready ∧ ready → active
 */

function canScan(approvalStatus: string): boolean {
  return approvalStatus === 'approved';
}

function canBecomeActive(status: string): boolean {
  return status === 'ready';
}

function exceedsUploadLimit(byteSize: number, maxBytes: number): boolean {
  return byteSize > maxBytes;
}

function dualReady(embedReady: number, esReady: number): boolean {
  return embedReady === 1 && esReady === 1;
}

describe('document gates', () => {
  it('ADR-048: scan only after approved', () => {
    expect(canScan('approved')).toBe(true);
    expect(canScan('pending')).toBe(false);
    expect(canScan('rejected')).toBe(false);
  });

  it('lifecycle active only when status=ready', () => {
    expect(canBecomeActive('ready')).toBe(true);
    expect(canBecomeActive('uploaded')).toBe(false);
    expect(canBecomeActive('indexing_es')).toBe(false);
    expect(canBecomeActive('needs_ocr')).toBe(false);
  });

  it('ADR-039: size gate', () => {
    expect(exceedsUploadLimit(100, 50)).toBe(true);
    expect(exceedsUploadLimit(50, 50)).toBe(false);
  });

  it('dual-ready requires both flags', () => {
    expect(dualReady(1, 1)).toBe(true);
    expect(dualReady(1, 0)).toBe(false);
    expect(dualReady(0, 1)).toBe(false);
  });
});
