/**
 * 目标：上传人选必须走 for-upload 结果，禁止写死默认策略码。
 * 需求：功能表 §4.5
 * 被测：pickUploadChunkStrategy
 * 简介：仅 1 个用 autoCode；≥2 须人选或 recommended。
 */

import { describe, expect, it } from 'vitest';

import { pickUploadChunkStrategy } from '@/app/(ops)/documents/upload.services';
import type { ForUploadResponse } from '@strict-rag/contracts';

function plan(over: Partial<ForUploadResponse>): ForUploadResponse {
  return {
    contentType: 'text/plain',
    family: 'txt',
    available: [{ code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true }],
    recommendedCode: 'structure_paragraph',
    requireExplicit: false,
    autoCode: 'structure_paragraph',
    ...over,
  };
}

describe('pickUploadChunkStrategy', () => {
  it('仅 1 个可用 → autoCode', () => {
    expect(pickUploadChunkStrategy(plan({}))).toEqual({
      ok: true,
      code: 'structure_paragraph',
    });
  });

  it('≥2 未选但有 recommended → 用 recommended', () => {
    const r = pickUploadChunkStrategy(
      plan({
        requireExplicit: true,
        autoCode: null,
        available: [
          { code: 'structure_paragraph', name: '结构段落', implemented: true, recommended: true },
          { code: 'fixed_window', name: '固定窗口', implemented: true, recommended: false },
        ],
      }),
    );
    expect(r).toEqual({ ok: true, code: 'structure_paragraph' });
  });

  it('无可用且未选 → 失败', () => {
    const r = pickUploadChunkStrategy(
      plan({
        available: [],
        recommendedCode: null,
        autoCode: null,
        requireExplicit: false,
      }),
    );
    expect(r.ok).toBe(false);
  });
});
