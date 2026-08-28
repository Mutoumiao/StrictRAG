/**
 * 目标：runRetrieve 双闸、preferred 提升与语料责任边界必须成立。
 * 需求：prds/04-pipelines
 * 被测：runRetrieve / promotePreferredDocChunks
 * 简介：默认 mock ES；双闸由 caller corpus 负责。
 */

import { describe, expect, it, vi } from 'vitest';

import { logger } from '../../src/logger.js';
import { GatewayError } from '../../src/services/gateway/index.js';
import { mockEmbedVector } from '../../src/services/gateway/mock-client.js';
import { promotePreferredDocChunks, runRetrieve } from '../../src/services/retrieve/retrieve.js';
import { sparseOverlapScore } from '../../src/services/retrieve/scoring.js';
import type { CorpusChunk, RetrieveDeps } from '../../src/services/retrieve/types.js';

const retrieveKb = { configJson: {} as Record<string, unknown> };

vi.mock('../../src/services/kb-settings.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/kb-settings.js')>();
  return {
    ...actual,
    kbSettingsRepo: {
      get: async () => ({
        id: 'kb1',
        name: 'KB',
        description: null,
        configJson: retrieveKb.configJson,
      }),
    },
  };
});

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

describe('runRetrieve dual gate via corpus', () => {
  it('rejects non-member (depth slot)', async () => {
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
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
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'anything', membership: 'member' },
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
        tenantId: 'tenant-1',
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

  it('forwards userId to loadCorpus', async () => {
    let seen: string | undefined;
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
        kbId: 'kb1',
        question: 'leave policy',
        membership: 'member',
        userId: 'u-dept',
      },
      deps([chunk('c1', 'leave policy 15 days')], {
        loadCorpus: async (input) => {
          seen = input.userId;
          return [chunk('c1', 'leave policy 15 days')];
        },
      }),
    );
    expect(r.ok).toBe(true);
    expect(seen).toBe('u-dept');
  });

  it('super_admin same path as member (no doc-acl terms)', async () => {
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
        kbId: 'kb1',
        question: 'leave',
        membership: 'super_admin',
      },
      deps([chunk('c1', 'leave policy')]),
    );
    expect(r.ok).toBe(true);
  });

  it('env false + KB true：super_admin 打 dept_acl_bypass', async () => {
    retrieveKb.configJson = { deptAclEnforce: true };
    const prev = process.env.DEPT_ACL_ENFORCE;
    process.env.DEPT_ACL_ENFORCE = 'false';
    const info = vi.spyOn(logger, 'info');
    try {
      const r = await runRetrieve(
        {
          tenantId: 'tenant-1',
          kbId: 'kb1',
          question: 'leave policy',
          membership: 'super_admin',
          userId: 'u-sa',
        },
        deps([chunk('c1', 'leave policy 15 days')]),
      );
      expect(r.ok).toBe(true);
      expect(info).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'dept_acl_bypass', kbId: 'kb1' }),
        'dept acl bypass',
      );
    } finally {
      info.mockRestore();
      retrieveKb.configJson = {};
      if (prev === undefined) delete process.env.DEPT_ACL_ENFORCE;
      else process.env.DEPT_ACL_ENFORCE = prev;
    }
  });

  it('forwards bypassDeptAcl when membership is super_admin', async () => {
    let seen: boolean | undefined;
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
        kbId: 'kb1',
        question: 'leave policy',
        membership: 'super_admin',
        userId: 'u-sa',
      },
      deps([chunk('c1', 'leave policy 15 days')], {
        loadCorpus: async (input) => {
          seen = input.bypassDeptAcl;
          return [chunk('c1', 'leave policy 15 days')];
        },
      }),
    );
    expect(r.ok).toBe(true);
    expect(seen).toBe(true);
  });

  it('member 不转发 bypassDeptAcl', async () => {
    let seen: boolean | undefined;
    const r = await runRetrieve(
      {
        tenantId: 'tenant-1',
        kbId: 'kb1',
        question: 'leave policy',
        membership: 'member',
      },
      deps([chunk('c1', 'leave policy 15 days')], {
        loadCorpus: async (input) => {
          seen = input.bypassDeptAcl;
          return [chunk('c1', 'leave policy 15 days')];
        },
      }),
    );
    expect(r.ok).toBe(true);
    expect(seen).toBe(false);
  });

  it('low_retrieval when no text/embedding match', async () => {
    const r = await runRetrieve(
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'zzzznotfound', membership: 'member' },
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
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'leave', membership: 'member' },
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
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'leave policy', membership: 'member' },
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
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'leave', membership: 'member' },
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
        tenantId: 'tenant-1',
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

  it('http sparseSearch throw → sparse_unavailable (no mock fallback)', async () => {
    const r = await runRetrieve(
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'leave', membership: 'member' },
      deps([chunk('c1', 'leave')], {
        esMode: 'http',
        sparseSearch: async () => {
          throw new Error('es down');
        },
      }),
    );
    expect(r).toMatchObject({ ok: false, reason: 'sparse_unavailable' });
  });
});

describe('promotePreferredDocChunks', () => {
  it('no preferred → original fused slice', () => {
    const fused = [
      { id: 'c1', score: 0.9 },
      { id: 'c2', score: 0.8 },
    ];
    expect(promotePreferredDocChunks(fused, [], undefined, 2)).toEqual(fused);
    expect(promotePreferredDocChunks(fused, [], [], 1)).toEqual([{ id: 'c1', score: 0.9 }]);
  });

  it('promotes in-fused preferred and inserts gated extras; keeps others', () => {
    const fused = [
      { id: 'c1', score: 0.9 },
      { id: 'c2', score: 0.8 },
      { id: 'c3', score: 0.1 },
    ];
    const corpus = [
      chunk('c1', 'other-hi', { docId: 'd-other' }),
      chunk('c2', 'other-mid', { docId: 'd-other' }),
      chunk('c3', 'pref-low', { docId: 'd-pref' }),
      chunk('c4', 'pref-miss', { docId: 'd-pref' }),
    ];
    const out = promotePreferredDocChunks(fused, corpus, ['d-pref'], 3);
    expect(out.map((x) => x.id)).toEqual(['c3', 'c4', 'c1']);
  });

  it('drops preferred not in gated corpus', () => {
    const fused = [
      { id: 'c1', score: 0.9 },
      { id: 'c2', score: 0.8 },
    ];
    const corpus = [chunk('c1', 'a', { docId: 'd1' }), chunk('c2', 'b', { docId: 'd2' })];
    expect(promotePreferredDocChunks(fused, corpus, ['d-ghost'], 2)).toEqual(fused);
  });
});

describe('runRetrieve preferredDocIds', () => {
  it('gated preferred chunk is earlier in rerank candidates', async () => {
    const corpus = [
      chunk('o1', 'annual leave policy 15 days', { docId: 'd-other' }),
      chunk('o2', 'annual leave request manager', { docId: 'd-other' }),
      chunk('o3', 'annual leave calendar holiday', { docId: 'd-other' }),
      chunk('p1', 'zzzz wifi password wall sticker', { docId: 'd-pref' }),
    ];
    const seen: string[][] = [];
    const rerankSpy: RetrieveDeps['rerank'] = async (query, passages, topN) => {
      seen.push(passages);
      return passages.slice(0, topN).map((_, index) => ({ index, score: 1 - index * 0.01 }));
    };
    const base = {
      tenantId: 'tenant-1',
      kbId: 'kb1',
      question: 'annual leave policy days',
      membership: 'member' as const,
      retrieveK: 2,
      rerankTopN: 2,
    };
    const off = await runRetrieve(base, deps(corpus, { rerank: rerankSpy }));
    const on = await runRetrieve(
      { ...base, preferredDocIds: ['d-pref'] },
      deps(corpus, { rerank: rerankSpy }),
    );
    expect(off.ok && on.ok).toBe(true);
    const offPass = seen[0] ?? [];
    const onPass = seen[1] ?? [];
    expect(onPass[0]).toContain('wifi password');
    expect(offPass[0]).not.toContain('wifi password');
    if (on.ok) {
      expect(on.evidence.every((e) => corpus.some((c) => c.chunkId === e.chunkId))).toBe(true);
      expect(on.meta.preferredAdopted).toBe(true);
    }
  });

  it('preferred outside corpus → same as no boost', async () => {
    const corpus = [chunk('c1', 'leave policy 15 days', { docId: 'd1' })];
    const seen: string[][] = [];
    const rerankSpy: RetrieveDeps['rerank'] = async (_q, passages, topN) => {
      seen.push(passages);
      return passages.slice(0, topN).map((_, index) => ({ index, score: 1 }));
    };
    const base = {
      tenantId: 'tenant-1',
      kbId: 'kb1',
      question: 'leave policy',
      membership: 'member' as const,
    };
    await runRetrieve(base, deps(corpus, { rerank: rerankSpy }));
    const r = await runRetrieve(
      { ...base, preferredDocIds: ['d-ghost'] },
      deps(corpus, { rerank: rerankSpy }),
    );
    expect(r.ok).toBe(true);
    expect(seen[0]).toEqual(seen[1]);
    if (r.ok) expect(r.meta.preferredAdopted).toBe(false);
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
      { tenantId: 'tenant-1', kbId: 'kb1', question: 'leave', membership: 'member' },
      deps(gated),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.evidence.every((e) => e.lifecycle === 'active')).toBe(true);
    }
  });
});
