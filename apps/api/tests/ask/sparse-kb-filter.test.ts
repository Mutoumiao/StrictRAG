/**
 * 目标：共享索引查询必须按 kbId term 过滤，外库 chunk 不得进入 evidence。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 O1
 * 被测：searchSparseEs query filter · runRetrieve http sparse 按 corpus byId 丢外库
 * 简介：默认 mock ES。只锁 kbId term filter；must 的问句不夹带其他 kb。
 * ≠ 生产多租户独立索引；≠ tenantId 门禁（O4 缺实现）。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { searchSparseEs } from '../../src/services/retrieve/es-sparse.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';

const KB_A = 'kb-tenant-a';
const KB_B = 'kb-tenant-b';
const dims = 8;

afterEach(() => {
  vi.unstubAllGlobals();
});

function chunk(id: string, text: string, opts: Partial<CorpusChunk> = {}): CorpusChunk {
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

function retrieveDeps(corpus: CorpusChunk[], overrides: Partial<RetrieveDeps> = {}): RetrieveDeps {
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
    ...overrides,
  };
}

describe('O1 shared-index kbId filter', () => {
  it('searchSparseEs POST body：filter 含 { term: { kbId } }，must 不夹带其他 kb', async () => {
    let capturedBody: unknown;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body ?? '{}'));
        return {
          ok: true,
          json: async () => ({ hits: { hits: [] } }),
        };
      }),
    );

    const question = '年假政策天数';
    await searchSparseEs(
      { baseUrl: 'http://es:9200', index: 'strict_rag_dev' },
      { kbId: KB_A, question, size: 10 },
    );

    expect(capturedBody).toEqual(
      expect.objectContaining({
        query: {
          bool: {
            filter: [{ term: { kbId: KB_A } }],
            must: [{ match: { sparseText: question } }],
          },
        },
      }),
    );
    const dump = JSON.stringify(capturedBody);
    expect(dump).toContain(KB_A);
    expect(dump).not.toContain(KB_B);
  });

  it('runRetrieve http：sparse 若返回外 kb chunkId，按 corpus byId 丢掉', async () => {
    const local = chunk('c-kb-a', 'employee leave policy allows 15 days annual leave', {
      docId: 'd-a',
    });
    const r = await runRetrieve(
      {
        kbId: KB_A,
        question: 'annual leave policy days',
        membership: 'member',
        rerankTopN: 4,
      },
      retrieveDeps([local], {
        sparseSearch: async (input) => {
          expect(input.kbId).toBe(KB_A);
          return ['c-kb-b-foreign', 'c-kb-a'];
        },
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evidence.some((e) => e.chunkId === 'c-kb-b-foreign')).toBe(false);
    expect(r.evidence.every((e) => e.chunkId === 'c-kb-a')).toBe(true);
  });
});
