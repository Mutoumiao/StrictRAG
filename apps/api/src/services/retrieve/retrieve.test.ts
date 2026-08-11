import { describe, expect, it } from 'vitest';

import { GatewayError } from '../gateway/index.js';
import { mockEmbedVector } from '../gateway/mock-client.js';
import { rrfFuse } from './rrf.js';
import { runRetrieve } from './retrieve.js';
import { cosine, sparseOverlapScore } from './scoring.js';
import type { CorpusChunk, RetrieveDeps } from './types.js';

const dims = 8;

function chunk(
  id: string,
  text: string,
  opts: Partial<CorpusChunk> = {},
): CorpusChunk {
  return {
    chunkId: id,
    docId: opts.docId ?? `doc-${id}`,
    title: opts.title ?? `T-${id}`,
    text,
    preview: text.slice(0, 40),
    lifecycle: opts.lifecycle ?? 'active',
    embedding: opts.embedding ?? mockEmbedVector(text, dims),
    docType: opts.docType,
  };
}

function deps(corpus: CorpusChunk[], overrides: Partial<RetrieveDeps> = {}): RetrieveDeps {
  return {
    loadCorpus: async () => corpus,
    embed: async (texts) => texts.map((t) => mockEmbedVector(t, dims)),
    rerank: async (query, passages, topN) => {
      const scored = passages
        .map((p, index) => ({
          index,
          score: sparseOverlapScore(query, p),
        }))
        .sort((a, b) => b.score - a.score);
      return scored.slice(0, Math.min(topN, scored.length));
    },
    esMode: 'mock',
    ...overrides,
  };
}

describe('scoring / rrf', () => {
  it('cosine is 1 for identical vectors', () => {
    const v = mockEmbedVector('hello world', dims);
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  it('rrf prefers items high in multiple lists', () => {
    const fused = rrfFuse([
      ['a', 'b', 'c'],
      ['b', 'a', 'd'],
    ]);
    expect(fused[0]?.id).toBe('a');
    // a ranks 1+2, b ranks 2+1 — a slightly higher with k=60
    expect(fused.map((f) => f.id)).toContain('b');
  });
});

describe('runRetrieve dual gate via corpus', () => {
  it('rejects non-member (depth slot)', async () => {
    const r = await runRetrieve(
      {
        kbId: 'kb1',
        question: 'leave policy',
        membership: 'none',
      },
      deps([chunk('c1', 'leave policy 15 days')]),
    );
    expect(r).toMatchObject({ ok: false, reason: 'not_member' });
  });

  it('kb_not_ready when corpus empty (no ready∧active)', async () => {
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'anything', membership: 'member' },
      deps([]),
    );
    expect(r).toMatchObject({ ok: false, reason: 'kb_not_ready' });
  });

  it('returns evidence after hybrid + rerank for member', async () => {
    const corpus = [
      chunk('c1', 'employee leave policy allows 15 days annual leave'),
      chunk('c2', 'office wifi password is printed on the wall'),
      chunk('c3', 'annual leave request must be approved by manager'),
    ];
    const r = await runRetrieve(
      {
        kbId: 'kb1',
        question: 'annual leave policy days',
        membership: 'member',
        rerankTopN: 2,
      },
      deps(corpus),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evidence.length).toBeGreaterThan(0);
    expect(r.evidence.length).toBeLessThanOrEqual(2);
    expect(r.evidence[0]?.chunkId).toBeTruthy();
    expect(r.meta.esMode).toBe('mock');
    // leave-related chunks should rank above wifi
    const ids = r.evidence.map((e) => e.chunkId);
    expect(ids).not.toContain('c2');
  });

  it('super_admin same path as member (no doc-acl terms)', async () => {
    const r = await runRetrieve(
      {
        kbId: 'kb1',
        question: 'leave',
        membership: 'super_admin',
      },
      deps([chunk('c1', 'leave policy')]),
    );
    expect(r.ok).toBe(true);
  });

  it('low_retrieval when no text/embedding match', async () => {
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'zzzznotfound', membership: 'member' },
      deps([
        {
          chunkId: 'c1',
          docId: 'd1',
          text: '',
          embedding: undefined,
        },
      ]),
    );
    expect(r).toMatchObject({ ok: false, reason: 'low_retrieval' });
  });

  it('embed failure → low_retrieval (not silent empty)', async () => {
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'leave', membership: 'member' },
      deps([chunk('c1', 'leave policy')], {
        embed: async () => {
          throw new GatewayError('timeout', 'embed down', 'embed');
        },
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'low_retrieval' });
  });

  it('rerank failure → rerank_unavailable (no RRF answered)', async () => {
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'leave policy', membership: 'member' },
      deps([chunk('c1', 'leave policy')], {
        rerank: async () => {
          throw new GatewayError('exhausted', 'rerank chain dead', 'rerank');
        },
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'rerank_unavailable' });
  });

  it('http es mode without sparseSearch → internal_guard (no mock fallback)', async () => {
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'leave', membership: 'member' },
      deps([chunk('c1', 'leave')], { esMode: 'http' }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'internal_guard' });
  });

  it('http es mode with sparseSearch returns live meta', async () => {
    const corpus = [
      chunk('c1', 'employee leave policy allows 15 days annual leave'),
      chunk('c2', 'office wifi password is printed on the wall'),
    ];
    const r = await runRetrieve(
      {
        kbId: 'kb1',
        question: 'annual leave policy',
        membership: 'member',
        rerankTopN: 2,
      },
      deps(corpus, {
        esMode: 'http',
        sparseSearch: async () => ['c1', 'c2'],
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.esMode).toBe('http');
      expect(r.meta.sparseHits).toBeGreaterThan(0);
      expect(r.evidence.some((e) => e.chunkId === 'c1')).toBe(true);
    }
  });

  it('http sparseSearch throw → internal_guard (no mock fallback)', async () => {
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'leave', membership: 'member' },
      deps([chunk('c1', 'leave')], {
        esMode: 'http',
        sparseSearch: async () => {
          throw new Error('es down');
        },
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'internal_guard' });
  });
});

describe('dual gate is caller corpus responsibility', () => {
  /**
   * isDefaultRetrievable 已在 packages/db 单测；
   * 此处验证 loadCorpus 注入侧：draft 不得混入 corpus。
   * 生产 loadCorpusFromDb 用 isDefaultRetrievable 过滤。
   */
  it('injected corpus without draft-like docs only returns active texts', async () => {
    // 模拟闸后只剩 active
    const gated = [chunk('ok', 'active leave policy', { lifecycle: 'active' })];
    const r = await runRetrieve(
      { kbId: 'kb1', question: 'leave', membership: 'member' },
      deps(gated),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.evidence.every((e) => e.lifecycle === 'active')).toBe(true);
    }
  });
});
