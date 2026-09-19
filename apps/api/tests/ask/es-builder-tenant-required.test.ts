/**
 * 目标：无 tenantId 的 ES query / bulk builder 必须失败，不得静默少过滤或回退全租户。
 * 需求：剧本 O4 · ADR-041（filter 即使独立也强制）
 * 被测：buildAclFilter / sparseBulkSource
 * 简介：缺 / 空串 / 纯空白 tenantId 一律抛；带 tenantId 时 kbId 与租户 filter 逐位不变。
 */

import { describe, expect, it } from 'vitest';

import {
  EsSparseError,
  buildAclFilter,
  sparseBulkSource,
} from '../../src/services/retrieve/es-sparse.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

function bulkDoc(tenantId: unknown) {
  return {
    chunkId: 'c1',
    tenantId,
    kbId: KB,
    docId: 'd1',
    sparseText: '正文',
  } as never;
}

describe('ES builder 的 tenantId 硬约束（剧本 O4）', () => {
  it('query builder：缺 tenantId 即失败（不静默少过滤）', () => {
    expect(() => buildAclFilter({ tenantId: undefined as never, kbId: KB })).toThrow(
      EsSparseError,
    );
  });

  it('query builder：空串 / 纯空白 tenantId 即失败', () => {
    expect(() => buildAclFilter({ tenantId: '', kbId: KB })).toThrow(/missing tenantId/);
    expect(() => buildAclFilter({ tenantId: '   ', kbId: KB })).toThrow(/missing tenantId/);
  });

  it('bulk builder：缺 tenantId 即失败（不补默认租户）', () => {
    expect(() => sparseBulkSource(bulkDoc(undefined))).toThrow(/missing tenantId/);
    expect(() => sparseBulkSource(bulkDoc(''))).toThrow(/missing tenantId/);
  });

  it('有 tenantId：租户 + kbId filter 逐位不变（未放宽既有闸）', () => {
    expect(buildAclFilter({ tenantId: TENANT, kbId: KB })).toEqual([
      { term: { tenantId: TENANT } },
      { term: { kbId: KB } },
    ]);
  });

  it('有 tenantId：bulk source 原样写入（收尾空白被裁掉）', () => {
    expect(sparseBulkSource(bulkDoc(` ${TENANT} `))).toMatchObject({
      tenantId: TENANT,
      kbId: KB,
      chunkId: 'c1',
    });
  });
});
