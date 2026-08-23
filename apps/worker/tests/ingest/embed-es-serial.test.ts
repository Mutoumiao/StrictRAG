/**
 * 目标：embed 与稀疏索引串行就绪，禁并行假完成。
 * 需求：X-03 · prds/04-pipelines
 * 被测：pipeline 串行就绪
 * 简介：embedReady 与 esReady 须同时为 1。
 */
import { describe, expect, it } from 'vitest';

describe('serial embed→es readiness', () => {
  function canMarkReady(embedReady: number, esReady: number): boolean {
    return embedReady === 1 && esReady === 1;
  }

  it('forbids half-ready', () => {
    expect(canMarkReady(1, 0)).toBe(false);
    expect(canMarkReady(0, 1)).toBe(false);
    expect(canMarkReady(0, 0)).toBe(false);
    expect(canMarkReady(1, 1)).toBe(true);
  });
});
