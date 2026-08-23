/**
 * 目标：可见知识库列表只返回当前身份能看到的库。
 * 需求：壳下拉数据
 * 被测：selectVisibleKbs / toKbListItem
 * 简介：可见库列表。
 */

import { describe, expect, it } from 'vitest';

import { selectVisibleKbs, toKbListItem } from '../../src/services/kb-list.js';

const a = { id: 'k1', tenantId: 't1', name: 'A', description: null };
const b = { id: 'k2', tenantId: 't1', name: 'B', description: 'x' };

describe('selectVisibleKbs', () => {
  it('bypass returns all', () => {
    expect(selectVisibleKbs({ all: [a, b], memberKbIds: new Set(), bypass: true })).toEqual([a, b]);
  });

  it('member only sees joined kbs', () => {
    expect(selectVisibleKbs({ all: [a, b], memberKbIds: new Set(['k2']), bypass: false })).toEqual([
      b,
    ]);
  });

  it('non-member sees none', () => {
    expect(selectVisibleKbs({ all: [a, b], memberKbIds: new Set(), bypass: false })).toEqual([]);
  });
});

describe('toKbListItem', () => {
  it('maps description', () => {
    expect(toKbListItem(b)).toEqual({ id: 'k2', tenantId: 't1', name: 'B', description: 'x' });
  });

  it('keeps null description', () => {
    expect(toKbListItem(a)).toEqual({ id: 'k1', tenantId: 't1', name: 'A', description: null });
  });
});
