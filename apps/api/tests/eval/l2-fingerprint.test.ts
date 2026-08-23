/**
 * 目标：rewrite 指纹纯函数稳定，且不因此打开 rewrite。
 * 需求：ADR-046 相关
 * 被测：l2RewriteFingerprint
 * 简介：非开 rewrite。
 */

import { describe, expect, it } from 'vitest';

import { l2RewriteFingerprint } from '../../src/eval/l2-fingerprint.js';

describe('l2RewriteFingerprint', () => {
  it('same prompt+model is stable', () => {
    const a = l2RewriteFingerprint('rewrite-prompt', 'model-a');
    const b = l2RewriteFingerprint('rewrite-prompt', 'model-a');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('one-char prompt change or modelId change yields a different hash', () => {
    const base = l2RewriteFingerprint('rewrite-prompt', 'model-a');
    expect(l2RewriteFingerprint('rewrite-prompX', 'model-a')).not.toBe(base);
    expect(l2RewriteFingerprint('rewrite-prompt', 'model-b')).not.toBe(base);
  });
});
