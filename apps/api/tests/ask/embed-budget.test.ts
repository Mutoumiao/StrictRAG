/**
 * 目标：query embed 只发生在 retrieve，次数不超过 retrieve 次且不计入 LLM 预算。
 * 需求：剧本 R1 · 剧本 R2 · 剧本 R3 · prds/10-delivery/03-acceptance-scenarios.md · ADR-044
 * 被测：runRetrieve embed / runAskGraph
 * 简介：两次 retrieve 只 embed 两次；图节点不调 embed；不得把 chunk 正文传入 embed。
 */

import { describe, expect, it, vi } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';
import {
  CHUNK,
  DOC,
  baseInput,
  deps as graphDeps,
  evidenceOk,
  happyChat,
  runAskGraph,
  type GraphChat,
  type GraphDeps,
} from './_support/graph-harness.js';

const dims = 8;
const BODY = 'UNIQUE_BODY_TEXT_MUST_NOT_BE_EMBEDDED 年假政策允许十五天。';
const QUESTION = '年假政策几天';

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

function retrieveDeps(
  corpus: CorpusChunk[],
  overrides: Partial<RetrieveDeps> = {},
): RetrieveDeps {
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

describe('embed only in retrieve', () => {
  it('two retrieve calls embed the question twice and not as LLM', async () => {
    const corpus = [chunk(CHUNK, BODY, { docId: DOC }), chunk('c2', '办公室wifi密码贴在墙上')];
    const embed = vi.fn(async (texts: string[]) => texts.map((t) => mockEmbedVector(t, dims)));
    const d = retrieveDeps(corpus, { embed });
    const input = { kbId: 'kb1', question: QUESTION, membership: 'member' as const };

    const r1 = await runRetrieve(input, d);
    const r2 = await runRetrieve(input, d);
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);
    expect(embed).toHaveBeenCalledTimes(2);
    expect(embed.mock.calls[0]?.[0]).toEqual([QUESTION]);
    expect(embed.mock.calls[1]?.[0]).toEqual([QUESTION]);

    const graph = await runAskGraph(baseInput({ question: QUESTION }), {
      chat: happyChat,
      retrieveDeps: retrieveDeps(corpus, { embed }),
      budgetOverride: { maxLLMCalls: 3, maxRetrieveCalls: 6 },
    });
    expect(graph.status).toBe('answered');
    expect(graph.reason).toBe('verified');
    expect(graph.debug?.llmCalls).toBe(3);
    expect(graph.debug?.retrieveCalls).toBe(1);
    expect(embed).toHaveBeenCalledTimes(3);
  });

  it('route/generate/verify do not call embed when retrieve is injected', async () => {
    type GraphDepsHasEmbed = 'embed' extends keyof GraphDeps ? true : false;
    const graphDepsHasEmbed: GraphDepsHasEmbed = false;
    expect(graphDepsHasEmbed).toBe(false);

    const embed = vi.fn();
    const purposes: string[] = [];
    const chat: GraphChat = async (purpose, messages) => {
      purposes.push(purpose);
      return happyChat(purpose, messages);
    };
    const injected = graphDeps({
      chat,
      retrieve: async () => ({
        ok: true,
        evidence: evidenceOk,
        meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
      }),
    });
    expect('embed' in injected).toBe(false);

    const r = await runAskGraph(baseInput(), injected);
    expect(r.status).toBe('answered');
    expect(purposes).toEqual(['generate', 'claim_split', 'judge']);
    expect(embed).not.toHaveBeenCalled();
  });

  it('ask retrieve embeds only the question, never chunk body', async () => {
    const corpus = [chunk('c1', BODY)];
    const embed = vi.fn(async (texts: string[]) => {
      expect(texts).toEqual([QUESTION]);
      expect(texts.some((t) => t.includes(BODY))).toBe(false);
      return texts.map((t) => mockEmbedVector(t, dims));
    });
    const r = await runRetrieve(
      { kbId: 'kb1', question: QUESTION, membership: 'member' },
      retrieveDeps(corpus, { embed }),
    );
    expect(r.ok).toBe(true);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed.mock.calls[0]?.[0]).toEqual([QUESTION]);
    for (const [texts] of embed.mock.calls) {
      expect(texts).not.toContain(BODY);
      expect(texts.some((t) => t.includes('UNIQUE_BODY_TEXT_MUST_NOT_BE_EMBEDDED'))).toBe(
        false,
      );
    }
  });
});
