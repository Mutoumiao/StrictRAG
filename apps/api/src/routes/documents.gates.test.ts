import { describe, expect, it } from 'vitest';

/**
 * 文档门禁：测试 **route 实际 import 的 gates 模块**（非影子 if）。
 * Live HTTP 路径见 documents.gates.live.test.ts（需 PG+Redis ready）。
 */
import { canBecomeActive, canEnqueueScan } from '../gates/approval-scan.js';
import { checkUploadByteSize } from '../gates/upload-size.js';

describe('document gates (route-shared modules)', () => {
  it('ADR-048: scan only after approved', () => {
    expect(canEnqueueScan('approved')).toBe(true);
    expect(canEnqueueScan('pending')).toBe(false);
    expect(canEnqueueScan('rejected')).toBe(false);
  });

  it('lifecycle active only when status=ready', () => {
    expect(canBecomeActive('ready')).toBe(true);
    expect(canBecomeActive('uploaded')).toBe(false);
    expect(canBecomeActive('indexing_es')).toBe(false);
  });

  it('ADR-039: size gate', () => {
    expect(checkUploadByteSize(100, 50).ok).toBe(false);
    expect(checkUploadByteSize(50, 50).ok).toBe(true);
  });
});
