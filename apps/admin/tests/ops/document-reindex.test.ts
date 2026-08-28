/**
 * 目标：Reindex 人选在可用策略 ≥2 时未选不得提交。
 * 需求：功能表 §4.3 Reindex
 * 被测：pickReindexChunkStrategy
 * 简介：HTTP 闸在 api；本测只锁人选规则。
 */

import { describe, expect, it } from 'vitest';

import { pickReindexChunkStrategy } from '@/app/(ops)/documents/reindex.services';
import type { ForUploadResponse } from '@strict-rag/contracts';

function plan(over: Partial<ForUploadResponse>): ForUploadResponse {
  return {
    contentType: 'text/plain',
    family: 'txt',
    available: [
      { code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true },
      { code: 'fixed_window', name: '固定窗口', implemented: true, recommended: false },
    ],
    recommendedCode: 'structure_paragraph',
    requireExplicit: true,
    autoCode: null,
    ...over,
  };
}

describe('pickReindexChunkStrategy', () => {
  it('≥2 未选不可提交', () => {
    const r = pickReindexChunkStrategy(plan({}), undefined);
    expect(r.ok).toBe(false);
  });

  it('≥2 人选后可提交', () => {
    expect(pickReindexChunkStrategy(plan({}), 'fixed_window')).toEqual({
      ok: true,
      code: 'fixed_window',
    });
  });

  it('仅 1 个可用可自动', () => {
    const r = pickReindexChunkStrategy(
      plan({
        available: [
          { code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true },
        ],
        requireExplicit: false,
        autoCode: 'structure_paragraph',
      }),
    );
    expect(r).toEqual({ ok: true, code: 'structure_paragraph' });
  });
});
