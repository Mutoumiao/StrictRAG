import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHUNK_STRATEGY,
  isRegisteredChunkStrategy,
  listChunkStrategies,
  resolveDocumentChunkStrategy,
  resolveRequiredChunkStrategy,
  shouldRetainExistingStrategy,
} from './chunk-strategies.js';

describe('B12 chunk strategies', () => {
  it('注册表含多策略且默认可解析', () => {
    const list = listChunkStrategies();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(isRegisteredChunkStrategy(DEFAULT_CHUNK_STRATEGY)).toBe(true);
    expect(resolveRequiredChunkStrategy(undefined)).toEqual({
      ok: true,
      code: DEFAULT_CHUNK_STRATEGY,
    });
  });

  it('未知策略拒绝', () => {
    const r = resolveRequiredChunkStrategy('not_a_real_strategy');
    expect(r.ok).toBe(false);
  });

  it('旧文档不自动切换策略', () => {
    expect(
      shouldRetainExistingStrategy({
        existing: 'fixed_window',
        next: DEFAULT_CHUNK_STRATEGY,
        explicitChange: false,
      }),
    ).toBe(true);
    expect(
      shouldRetainExistingStrategy({
        existing: 'fixed_window',
        next: DEFAULT_CHUNK_STRATEGY,
        explicitChange: true,
      }),
    ).toBe(false);
  });

  it('resolveDocumentChunkStrategy：无显式请求保留旧策略', () => {
    const r = resolveDocumentChunkStrategy({
      existing: 'fixed_window',
      requested: undefined,
    });
    expect(r).toMatchObject({ ok: true, code: 'fixed_window', retained: true, changed: false });
  });

  it('resolveDocumentChunkStrategy：显式可改策略', () => {
    const r = resolveDocumentChunkStrategy({
      existing: 'fixed_window',
      requested: 'heading_sections',
    });
    expect(r).toMatchObject({
      ok: true,
      code: 'heading_sections',
      retained: false,
      changed: true,
    });
  });

  it('reindex 多策略 requireExplicit：未传 → 失败', () => {
    const r = resolveDocumentChunkStrategy({
      existing: 'fixed_window',
      requested: undefined,
      requireExplicit: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('required on reindex');
  });
});
