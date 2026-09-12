/**
 * 目标：语料装载必须叠生效窗口，未生效或已到期文档不得进检索集。
 * 需求：功能表 §5.4 · P0 R7 之后
 * 被测：filterDocsForRetrieve
 * 简介：注入 now；双闸仍由 ready-active-corpus 钉。
 */

import { describe, expect, it } from 'vitest';

import { filterDocsForRetrieve } from '../../src/services/retrieve/corpus.js';

const NOW = '2026-09-12 12:00:00';

describe('filterDocsForRetrieve 生效窗口', () => {
  const ready = { id: 'a', status: 'ready' as const, lifecycle: 'active' as const };

  it('缺界的 ready∧active 仍放行', () => {
    expect(filterDocsForRetrieve([ready], undefined, NOW).map((d) => d.id)).toEqual(['a']);
  });

  it('未到 from 滤掉', () => {
    const docs = [{ ...ready, effectiveFrom: '2026-09-12 12:00:01' }];
    expect(filterDocsForRetrieve(docs, undefined, NOW)).toEqual([]);
  });

  it('to == now 滤掉', () => {
    const docs = [{ ...ready, effectiveTo: NOW }];
    expect(filterDocsForRetrieve(docs, undefined, NOW)).toEqual([]);
  });

  it('窗内放行', () => {
    const docs = [
      {
        ...ready,
        effectiveFrom: '2026-09-01 00:00:00',
        effectiveTo: '2026-09-30 00:00:00',
      },
    ];
    expect(filterDocsForRetrieve(docs, undefined, NOW).map((d) => d.id)).toEqual(['a']);
  });

  it('draft 即使在窗口内也不放行', () => {
    const docs = [
      {
        id: 'd',
        status: 'ready',
        lifecycle: 'draft',
        effectiveFrom: '2026-09-01 00:00:00',
        effectiveTo: '2026-09-30 00:00:00',
      },
    ];
    expect(filterDocsForRetrieve(docs, undefined, NOW)).toEqual([]);
  });
});
