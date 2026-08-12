import { describe, expect, it } from 'vitest';

import {
  DEFAULT_CHUNK_STRATEGY,
  isImplementedChunkStrategy,
  isMultiStrategyCatalog,
  isRegisteredChunkStrategy,
  isWritableChunkStrategy,
  listChunkStrategies,
  listWritableChunkStrategies,
  resolveDocumentChunkStrategy,
  resolveRequiredChunkStrategy,
  shouldRetainExistingStrategy,
} from './chunk-strategies.js';

describe('B12 chunk strategies · 实现真 SSOT（X-03）', () => {
  it('catalog 含 roadmap 码；writable 仅 structure_paragraph', () => {
    const list = listChunkStrategies();
    expect(list.length).toBeGreaterThanOrEqual(2);
    expect(list.every((s) => typeof s.implemented === 'boolean')).toBe(true);
    expect(listWritableChunkStrategies().map((s) => s.code)).toEqual([
      DEFAULT_CHUNK_STRATEGY,
    ]);
    expect(isWritableChunkStrategy(DEFAULT_CHUNK_STRATEGY)).toBe(true);
    expect(isWritableChunkStrategy('fixed_window')).toBe(false);
    expect(isImplementedChunkStrategy('fixed_window')).toBe(false);
    expect(isRegisteredChunkStrategy('fixed_window')).toBe(true);
    expect(isMultiStrategyCatalog()).toBe(true);
  });

  it('未知策略拒绝', () => {
    const r = resolveRequiredChunkStrategy('not_a_real_strategy');
    expect(r.ok).toBe(false);
  });

  it('未实现策略拒绝写入（即便已注册）', () => {
    const r = resolveRequiredChunkStrategy('fixed_window');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not implemented/i);
  });

  it('默认可解析为 structure_paragraph', () => {
    expect(resolveRequiredChunkStrategy(undefined)).toEqual({
      ok: true,
      code: DEFAULT_CHUNK_STRATEGY,
    });
  });

  it('旧文档不自动切换策略（纯函数）', () => {
    expect(
      shouldRetainExistingStrategy({
        existing: 'structure_paragraph',
        next: DEFAULT_CHUNK_STRATEGY,
        explicitChange: false,
      }),
    ).toBe(true);
    expect(
      shouldRetainExistingStrategy({
        existing: DEFAULT_CHUNK_STRATEGY,
        next: 'fixed_window',
        explicitChange: true,
      }),
    ).toBe(false);
  });

  it('resolve：无显式请求保留旧已实现策略', () => {
    const r = resolveDocumentChunkStrategy({
      existing: DEFAULT_CHUNK_STRATEGY,
      requested: undefined,
    });
    expect(r).toMatchObject({
      ok: true,
      code: DEFAULT_CHUNK_STRATEGY,
      retained: true,
      changed: false,
    });
  });

  it('resolve：保留未实现旧策略 → 失败（禁假策略入库）', () => {
    const r = resolveDocumentChunkStrategy({
      existing: 'fixed_window',
      requested: undefined,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not implemented/i);
  });

  it('resolve：显式从未实现旧码改到已实现 → 成功', () => {
    const r = resolveDocumentChunkStrategy({
      existing: 'fixed_window',
      requested: DEFAULT_CHUNK_STRATEGY,
    });
    expect(r).toMatchObject({
      ok: true,
      code: DEFAULT_CHUNK_STRATEGY,
      retained: false,
      changed: true,
    });
  });

  it('resolve：显式改到未实现 → 失败', () => {
    const r = resolveDocumentChunkStrategy({
      existing: DEFAULT_CHUNK_STRATEGY,
      requested: 'heading_sections',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/not implemented/i);
  });

  it('多策略 requireExplicit：未传 → 失败（complete/reindex AA3）', () => {
    const r = resolveDocumentChunkStrategy({
      existing: null,
      requested: undefined,
      requireExplicit: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/chunkStrategy is required/i);
  });

  it('多策略 requireExplicit：已有已实现策略可省略并保留', () => {
    const r = resolveDocumentChunkStrategy({
      existing: DEFAULT_CHUNK_STRATEGY,
      requested: undefined,
      requireExplicit: false,
    });
    expect(r).toMatchObject({ ok: true, code: DEFAULT_CHUNK_STRATEGY, retained: true });
  });
});
