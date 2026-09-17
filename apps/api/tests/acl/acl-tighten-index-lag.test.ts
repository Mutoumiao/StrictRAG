/**
 * 目标：ACL 收紧后索引滞后（ES 仍持旧 principals）不得构成泄漏：稀疏命中的不可读块必须在 PG 闸被丢掉。
 * 需求：功能表 §5.5「收紧须 reindex」· ADR-009 决策 4（最终一致）· ES PRD §4.3 · 覆盖 B2-2 / B2-3 最小
 * 被测：runRetrieve（sparse 命中 → PG 语料求交）
 * 简介：语料由 PG 闸产出（收紧后不含该文档），稀疏路即便仍返回其 chunkId 也不得进 evidence；可读块召回不受影响。
 */

import { describe, expect, it, vi } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';

const TENANT = 'tenant-a';
const KB = 'kb-1';
const dims = 8;
const QUESTION = '年假多少天';

const READABLE = '01900000-0000-7000-8000-0000000000c1';
const READABLE_DOC = '01900000-0000-7000-8000-0000000000d1';
/** 收紧前该用户可读、收紧后不可读：ES 索引里仍是旧值（滞后） */
const STALE_HIT = '01900000-0000-7000-8000-0000000000c2';

vi.mock('../../src/services/kb-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/kb-settings.js')>();
  return {
    ...actual,
    kbSettingsRepo: {
      get: async () => ({
        id: KB,
        name: 'KB',
        description: null,
        configJson: {},
      }),
    },
  };
});

function chunk(chunkId: string, docId: string, text: string): CorpusChunk {
  return {
    chunkId,
    docId,
    title: `T-${docId}`,
    text,
    preview: text.slice(0, 40),
    lifecycle: 'active',
    embedding: mockEmbedVector(text, dims),
  };
}

/** PG 闸产出的语料（收紧后已不含 STALE_HIT 所属文档）+ 仍返回旧命中的稀疏路 */
function deps(corpus: CorpusChunk[], sparse: string[]): RetrieveDeps {
  return {
    loadCorpus: async () => corpus,
    embed: async (texts) => texts.map((t) => mockEmbedVector(t, dims)),
    rerank: async (query, passages, topN) => {
      const scored = passages
        .map((p, index) => ({ index, score: sparseOverlapScore(query, p) }))
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.min(topN, scored.length));
    },
    esMode: 'http',
    sparseSearch: async () => sparse,
  };
}

describe('ACL 收紧 + 索引滞后：ES 旧命中不得进 evidence', () => {
  it('语料只剩可读块时，稀疏路返回的不可读 chunkId 被丢弃', async () => {
    const corpus = [chunk(READABLE, READABLE_DOC, '员工年假为15天，需提前申请')];
    const result = await runRetrieve(
      { tenantId: TENANT, kbId: KB, question: QUESTION, membership: 'member', userId: 'u-1' },
      deps(corpus, [STALE_HIT, READABLE]),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const ids = result.evidence.map((e) => e.chunkId);
    expect(ids).toContain(READABLE);
    expect(ids).not.toContain(STALE_HIT);
    expect(JSON.stringify(result.evidence)).not.toContain(STALE_HIT);
  });

  it('滞后命中清空后语料为空 → 空库拒答 kb_not_ready，不得凭空 answered', async () => {
    const result = await runRetrieve(
      { tenantId: TENANT, kbId: KB, question: QUESTION, membership: 'member', userId: 'u-1' },
      deps([], [STALE_HIT]),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe('kb_not_ready');
  });
});
