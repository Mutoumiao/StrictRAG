/**
 * 目标：默认检索闸只放行 ready∧active，其它状态或生命周期不得进入默认检索集。
 * 需求：双就绪闸（P0 R7 附录；主锚在 api corpus）
 * 被测：isDefaultRetrievable · filterDefaultRetrievable
 * 简介：纯函数过滤；R7 生产路径在 api。
 */

import { describe, expect, it } from 'vitest';

import { filterDefaultRetrievable, isDefaultRetrievable } from '../../src/query/retrieval-gate.js';

describe('default retrieval gate', () => {
  it('allows only ready ∧ active', () => {
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'active' })).toBe(true);
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'draft' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'superseded' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'embedding', lifecycle: 'active' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'needs_ocr', lifecycle: 'active' })).toBe(false);
  });

  it('filters collection', () => {
    const docs = [
      { id: '1', status: 'ready', lifecycle: 'active' },
      { id: '2', status: 'ready', lifecycle: 'draft' },
      { id: '3', status: 'failed', lifecycle: 'active' },
    ];
    expect(filterDefaultRetrievable(docs).map((d) => d.id)).toEqual(['1']);
  });

  it('rejects needs_ocr / parsing / archived-like pairs', () => {
    expect(isDefaultRetrievable({ status: 'needs_ocr', lifecycle: 'active' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'parsing', lifecycle: 'active' })).toBe(false);
    expect(isDefaultRetrievable({ status: 'ready', lifecycle: 'archived' })).toBe(false);
  });
});
