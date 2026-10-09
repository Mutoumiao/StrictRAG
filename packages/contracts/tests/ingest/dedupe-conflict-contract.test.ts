/**
 * 目标：待审冲突处置 DTO 只收 `winner`（this / other）且拒绝未知字段；响应须回显三个身份字段并带 `reindexRequired` 布尔。
 * 需求：剧本 E4 · prds/04-pipelines/01-offline-ingest.md §5.1 · 数据 PRD §3.2
 * 被测：ResolveDedupeConflictBodySchema · ResolveDedupeConflictResponseSchema
 * 简介：只管 wire 形状；谁可调（doc.editor）与落库效果在 api 侧测。
 */

import { describe, expect, it } from 'vitest';

import {
  ResolveDedupeConflictBodySchema,
  ResolveDedupeConflictResponseSchema,
} from '../../src/ingest/dedupe-conflict.contract.js';

const DOC = '01900000-0000-7000-8000-0000000000d1';
const CHUNK = '01900000-0000-7000-8000-0000000000c1';

describe('ResolveDedupeConflictBodySchema', () => {
  it('只收 winner 的两个取值', () => {
    expect(ResolveDedupeConflictBodySchema.parse({ winner: 'this' })).toEqual({ winner: 'this' });
    expect(ResolveDedupeConflictBodySchema.parse({ winner: 'other' })).toEqual({ winner: 'other' });
  });

  it('拒绝缺 winner / 未知取值 / 多余字段', () => {
    expect(ResolveDedupeConflictBodySchema.safeParse({}).success).toBe(false);
    expect(ResolveDedupeConflictBodySchema.safeParse({ winner: 'both' }).success).toBe(false);
    expect(ResolveDedupeConflictBodySchema.safeParse({ winner: 'this', force: true }).success).toBe(
      false,
    );
  });
});

describe('ResolveDedupeConflictResponseSchema', () => {
  it('回显 docId / chunkId / winner 并带 reindexRequired', () => {
    const ok = { docId: DOC, chunkId: CHUNK, winner: 'this' as const, reindexRequired: true };
    expect(ResolveDedupeConflictResponseSchema.parse(ok)).toEqual(ok);
  });

  it('缺 reindexRequired 或 uuid 不合形即拒', () => {
    expect(
      ResolveDedupeConflictResponseSchema.safeParse({ docId: DOC, chunkId: CHUNK, winner: 'this' })
        .success,
    ).toBe(false);
    expect(
      ResolveDedupeConflictResponseSchema.safeParse({
        docId: 'not-a-uuid',
        chunkId: CHUNK,
        winner: 'this',
        reindexRequired: false,
      }).success,
    ).toBe(false);
  });
});
