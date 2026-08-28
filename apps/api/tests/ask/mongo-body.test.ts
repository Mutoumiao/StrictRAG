/**
 * 目标：融合后正文必须从 Mongo 批取权威切片，缺块或拉取失败须 fail-closed，禁止回退 PG 演示正文。
 * 需求：prds/03-data/02 §3.2 · prds/04-pipelines §5 步骤 6 · ADR-037
 * 被测：batchLoadChunkBodies · composeChunkSlice · runRetrieve loadBodies
 * 简介：切片口径 contextPrefix + "\n" + text；注入 loadBodies 后 evidence 用批取结果。
 */

import { describe, expect, it } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import {
  batchLoadChunkBodies,
  composeChunkSlice,
} from '../../src/services/retrieve/mongo-body.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';

const dims = 8;

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
    esMode: 'mock',
    ...overrides,
  };
}

describe('composeChunkSlice', () => {
  it('prefix + 换行 + text；prefix 空只留 text', () => {
    expect(composeChunkSlice('《制度》/第三章', '正文')).toBe('《制度》/第三章\n正文');
    expect(composeChunkSlice('  ', '正文')).toBe('正文');
  });
});

describe('batchLoadChunkBodies', () => {
  it('空 URL 抛错（不得静默回退）', async () => {
    await expect(batchLoadChunkBodies({ url: '  ', chunkIds: ['c1'] })).rejects.toThrow();
  });
});

describe('runRetrieve loadBodies', () => {
  it('注入后 evidence 文本来自批取权威切片，非 corpus.text', async () => {
    const corpus = [chunk('c1', 'pg 演示正文', { docId: 'd1' })];
    const r = await runRetrieve(
      { tenantId: 't1', kbId: 'kb1', question: '权威正文', membership: 'member' },
      retrieveDeps(corpus, {
        loadBodies: async (ids) => new Map([['c1', '《制度》\nMongo 权威正文']]),
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evidence[0]?.text).toBe('《制度》\nMongo 权威正文');
  });

  it('缺块 fail-closed，禁止回退 PG 演示正文', async () => {
    const corpus = [chunk('c1', 'pg 演示正文', { docId: 'd1' }), chunk('c2', 'pg 演示正文二', { docId: 'd2' })];
    const r = await runRetrieve(
      { tenantId: 't1', kbId: 'kb1', question: '权威正文', membership: 'member' },
      retrieveDeps(corpus, {
        loadBodies: async (ids) => new Map([['c1', '《制度》\nMongo 权威正文']]),
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'internal_guard' });
  });
});
