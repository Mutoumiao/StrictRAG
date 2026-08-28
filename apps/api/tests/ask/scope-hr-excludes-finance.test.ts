/**
 * 目标：hr scope 不得用 finance 文档作答；知识只在 finance 时必须拒答或无 finance 证据。
 * 需求：prds/10-delivery/03-acceptance-scenarios.md 剧本 X3
 * 被测：filterDocsForRetrieve · runRetrieve · runAskGraph
 * 简介：scope.docTypes=['hr'] 滤掉 finance；混库语料下 retrieve/evidence 不得含 finance，
 * 禁止用 finance 文本 answered。
 */

import { describe, expect, it } from 'vitest';

import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { filterDocsForRetrieve } from '../../src/services/retrieve/corpus.js';
import { runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps, RetrieveScope } from '../../src/services/retrieve/types.js';
import { baseInput, runAskGraph, scriptedChat } from './_support/graph-harness.js';

const HR_DOC = 'd-hr';
const FIN_DOC = 'd-fin';
const HR_CHUNK = 'c-hr';
const FIN_CHUNK = 'c-fin';
const FIN_TEXT = '年假有多少天 员工年假为15天须提前申请';
const HR_TEXT = '入职体检与培训清单不含休假制度';
const dims = 8;

const MIXED_DOCS = [
  { id: HR_DOC, status: 'ready', lifecycle: 'active', docType: 'hr' },
  { id: FIN_DOC, status: 'ready', lifecycle: 'active', docType: 'finance' },
] as const;

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

const MIXED_CHUNKS: CorpusChunk[] = [
  chunk(HR_CHUNK, HR_TEXT, { docId: HR_DOC, docType: 'hr', title: '人事入职' }),
  chunk(FIN_CHUNK, FIN_TEXT, { docId: FIN_DOC, docType: 'finance', title: '财务年假' }),
];

async function loadScopedCorpus(input: { scope?: RetrieveScope }): Promise<CorpusChunk[]> {
  const allowed = new Set(filterDocsForRetrieve([...MIXED_DOCS], input.scope).map((d) => d.id));
  return MIXED_CHUNKS.filter((c) => allowed.has(c.docId));
}

function retrieveDeps(overrides: Partial<RetrieveDeps> = {}): RetrieveDeps {
  return {
    loadCorpus: loadScopedCorpus,
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

function noFinance(rows: { docId?: string; chunkId?: string; text?: string }[]): void {
  expect(rows.some((e) => e.docId === FIN_DOC || e.chunkId === FIN_CHUNK)).toBe(false);
  expect(rows.some((e) => (e.text ?? '').includes('年假为15天'))).toBe(false);
}

describe('X3 hr scope excludes finance evidence', () => {
  it('filterDocsForRetrieve：scope.docTypes=["hr"] 滤掉 finance', () => {
    const ids = filterDocsForRetrieve([...MIXED_DOCS], { docTypes: ['hr'] }).map((d) => d.id);
    expect(ids).toEqual([HR_DOC]);
    expect(ids).not.toContain(FIN_DOC);
  });

  it('无 scope 时混库仍可召回 finance（夹具可泄漏，证明过滤不是空转）', async () => {
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
        kbId: 'kb1',
        question: '年假有多少天',
        membership: 'member',
      },
      retrieveDeps({
        loadCorpus: async () => MIXED_CHUNKS,
      }),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.evidence.some((e) => e.docId === FIN_DOC || e.chunkId === FIN_CHUNK)).toBe(true);
  });

  it('runRetrieve：hr scope 混库语料 evidence 不得含 finance', async () => {
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
        kbId: 'kb1',
        question: '年假有多少天',
        membership: 'member',
        scope: { docTypes: ['hr'] },
      },
      retrieveDeps(),
    );
    if (r.ok) {
      noFinance(r.evidence);
    } else {
      expect(['kb_not_ready', 'low_retrieval']).toContain(r.reason);
    }
  });

  it('runAskGraph：知识只在 finance + hr scope → 拒答，不得用 finance 文本 answered', async () => {
    const r = await runAskGraph(
      baseInput({
        question: '年假有多少天？',
        scope: { docTypes: ['hr'] },
      }),
      {
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [FIN_CHUNK],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [{ text: '年假为15天', chunkIds: [FIN_CHUNK] }],
          }),
          judge: JSON.stringify({ scores: [0.9] }),
        }),
        retrieveDeps: retrieveDeps(),
      },
    );

    noFinance(r.evidence_snapshot);
    expect(r.citations.every((c) => c.chunkId !== FIN_CHUNK)).toBe(true);
    if (r.status === 'answered') {
      expect(r.answer).not.toContain('15天');
      expect(r.answer).not.toContain('年假为15天');
    } else {
      expect(r.status).toBe('abstained');
      expect(r.answer).toBe('');
    }
  });
});
