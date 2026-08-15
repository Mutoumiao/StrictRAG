import { describe, expect, it } from 'vitest';

import { GatewayError } from '../services/gateway/index.js';
import { budgetForMode, tryChargeLlm, tryChargeRetrieve } from './budget.js';
import { ruleRoute } from './route-rules.js';
import { parseRewriteOutput } from './parse.js';
import { runAskGraph, type GraphChat, type GraphDeps } from './run.js';
import type { AskGraphInput } from './state.js';

const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';

const baseInput = (over: Partial<AskGraphInput> = {}): AskGraphInput => ({
  requestId: 'req-1',
  question: '年假有多少天？',
  kbId: 'kb-1',
  membership: 'member',
  tauClaim: 0.5,
  mode: 'balanced',
  ...over,
});

const evidenceOk = [
  {
    chunkId: CHUNK,
    docId: DOC,
    title: '休假制度',
    text: '员工年假为15天，须提前申请。',
    preview: '员工年假为15天',
    lifecycle: 'active',
    score: 0.9,
  },
];

function scriptedChat(map: Partial<Record<string, string | (() => string)>>): GraphChat {
  return async (purpose) => {
    const v = map[purpose];
    if (typeof v === 'function') return v();
    if (typeof v === 'string') return v;
    throw new Error(`unexpected purpose ${purpose}`);
  };
}

function deps(over: Partial<GraphDeps> & { chat: GraphChat }): GraphDeps {
  return {
    retrieve: async () => ({
      ok: true,
      evidence: evidenceOk,
      meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
    }),
    ...over,
  };
}

const happyChat = scriptedChat({
  generate: JSON.stringify({
    answer: '年假为15天。',
    citations: [CHUNK],
    insufficient: false,
  }),
  claim_split: JSON.stringify({
    claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
  }),
  judge: JSON.stringify({ scores: [0.9] }),
});

describe('ruleRoute (M1)', () => {
  it('chitchat hello', () => {
    expect(ruleRoute('你好').routeLabel).toBe('chitchat');
  });

  it('knowledge question → single', () => {
    expect(ruleRoute('年假有多少天？').routeLabel).toBe('single');
  });

  it('policy word → single not chitchat', () => {
    expect(ruleRoute('你好，年假政策').routeLabel).toBe('single');
  });
});

describe('budget table', () => {
  it('mode defaults ADR-032', () => {
    expect(budgetForMode('strict').maxLLMCalls).toBe(20);
    expect(budgetForMode('balanced').maxLLMCalls).toBe(16);
    expect(budgetForMode('fast').maxLLMCalls).toBe(8);
    expect(budgetForMode('fast').maxRetrieveCalls).toBe(2);
  });

  it('tryCharge guards', () => {
    expect(tryChargeLlm(8, 8, 1)).toBe(false);
    expect(tryChargeLlm(7, 8, 1)).toBe(true);
    expect(tryChargeRetrieve(2, 2)).toBe(false);
    expect(tryChargeRetrieve(0, 2)).toBe(true);
  });
});

describe('runAskGraph M1 route+retrieve', () => {
  it('chitchat answered without retrieve', async () => {
    let retrieved = false;
    const r = await runAskGraph(baseInput({ question: '你好' }), {
      chat: happyChat,
      retrieve: async () => {
        retrieved = true;
        return {
          ok: true,
          evidence: evidenceOk,
          meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
        };
      },
    });
    expect(retrieved).toBe(false);
    expect(r).toMatchObject({ status: 'answered', reason: 'chitchat', answerKind: 'chitchat' });
    expect(r.citations).toEqual([]);
  });

  it('empty evidence → low_retrieval abstained', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'low_retrieval' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'low_retrieval' });
    expect(r.answer).toBe('');
  });

  it('rerank failure → rerank_unavailable, no answered', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'rerank_unavailable' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'rerank_unavailable' });
  });

  it('kb_not_ready path', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'kb_not_ready' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'kb_not_ready' });
  });

  it('retrieve budget exhausted', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        budgetOverride: { maxLLMCalls: 16, maxRetrieveCalls: 0 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
  });
});

describe('runAskGraph M2 generate+citations', () => {
  it('illegal citations → invalid_citations (not answered)', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '瞎编答案',
            citations: ['99999999-9999-7999-8999-999999999999'],
            insufficient: false,
          }),
        }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'invalid_citations' });
  });

  it('mixed legal+illegal citations keeps only evidence ids and still verifies', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK, '99999999-9999-7999-8999-999999999999'],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
          }),
          judge: JSON.stringify({ scores: [0.9] }),
        }),
      }),
    );
    expect(r.status).toBe('answered');
    expect(r.reason).toBe('verified');
    expect(r.citations.map((c) => c.chunkId)).toEqual([CHUNK]);
  });

  it('insufficient flag → model_abstained', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({ answer: '', citations: [], insufficient: true }),
        }),
      }),
    );
    expect(r.reason).toBe('model_abstained');
  });
});

describe('runAskGraph M3 verify+min+budget', () => {
  it('R9: in-kb happy path → answered verified（必经 verify）', async () => {
    const r = await runAskGraph(baseInput(), deps({ chat: happyChat }));
    expect(r.status).toBe('answered');
    expect(r.reason).toBe('verified');
    expect(r.answer).toContain('15');
    expect(r.citations[0]?.chunkId).toBe(CHUNK);
    expect(r.minSupport).toBeGreaterThanOrEqual(0.5);
    // 合法 draft 必走 generate + claim_split + judge（3 次 LLM），禁止跳过 verify
    expect(r.debug?.llmCalls).toBe(3);
  });

  it('R8: min veto: one low score → unsupported_claims', async () => {
    const r = await runAskGraph(
      baseInput({ tauClaim: 0.5 }),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假15天且可无限延期。',
            citations: [CHUNK],
            insufficient: false,
          }),
          claim_split: JSON.stringify({
            claims: [
              { text: '年假15天', chunkIds: [CHUNK] },
              { text: '可无限延期', chunkIds: [CHUNK] },
            ],
          }),
          judge: JSON.stringify({ scores: [0.95, 0.1] }),
        }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'unsupported_claims' });
    expect(r.answer).toBe('');
  });

  it('R9: claim_split parse fail → 未完整 verify 不得 answered', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: scriptedChat({
          generate: JSON.stringify({
            answer: '年假为15天。',
            citations: [CHUNK],
            insufficient: false,
          }),
          claim_split: 'not-json-at-all',
        }),
      }),
    );
    expect(r.status).not.toBe('answered');
    expect(r).toMatchObject({ status: 'abstained', reason: 'claim_split_failed' });
  });

  it('claim_split gateway error → claim_split_failed', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: async (purpose) => {
          if (purpose === 'generate') {
            return JSON.stringify({
              answer: '年假为15天。',
              citations: [CHUNK],
              insufficient: false,
            });
          }
          throw new GatewayError('timeout', 'split down', 'chat');
        },
      }),
    );
    expect(r.reason).toBe('claim_split_failed');
  });

  it('llm budget exhausted before generate', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        budgetOverride: { maxLLMCalls: 0, maxRetrieveCalls: 6 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
  });

  it('llm budget exhausted on claim_split (after generate)', async () => {
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        budgetOverride: { maxLLMCalls: 1, maxRetrieveCalls: 6 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
  });

  it('session history never required for verified (evidence only)', async () => {
    const r = await runAskGraph(
      baseInput({ sessionId: '33333333-3333-7333-8333-333333333333' }),
      deps({ chat: happyChat }),
    );
    expect(r.reason).toBe('verified');
    expect(r.sessionId).toBe('33333333-3333-7333-8333-333333333333');
    // draft 不掺会话文本
    expect(r.answer).not.toMatch(/session|历史|刚才/);
  });
});

const SID = '33333333-3333-7333-8333-333333333333';
const SID_B = '44444444-4444-7444-8444-444444444444';
const STANDALONE = '差旅餐补标准是什么？';
const HIST_A = 'A会话里的餐补机密原文XYZ';

const rewriteHappyChat = scriptedChat({
  rewrite: JSON.stringify({ standalone: STANDALONE, resolved: true }),
  generate: JSON.stringify({
    answer: '年假为15天。',
    citations: [CHUNK],
    insufficient: false,
  }),
  claim_split: JSON.stringify({
    claims: [{ text: '年假为15天', chunkIds: [CHUNK] }],
  }),
  judge: JSON.stringify({ scores: [0.9] }),
});

describe('parseRewriteOutput', () => {
  it('success', () => {
    expect(parseRewriteOutput(JSON.stringify({ standalone: STANDALONE, resolved: true }))).toEqual({
      standalone: STANDALONE,
    });
  });
  it('resolved=false throws', () => {
    expect(() => parseRewriteOutput(JSON.stringify({ standalone: 'x', resolved: false }))).toThrow();
  });
  it('illegal JSON throws', () => {
    expect(() => parseRewriteOutput('not-json')).toThrow();
  });
  it('blank standalone throws', () => {
    expect(() => parseRewriteOutput(JSON.stringify({ standalone: '  ', resolved: true }))).toThrow();
  });
});

describe('runAskGraph P2.5 rewrite min', () => {
  it('off + session: no rewrite purpose; retrieve uses raw; loader not called', async () => {
    const purposes: string[] = [];
    let retrieveQ = '';
    let loaderCalls = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: false,
        loadSessionWindow: async () => {
          loaderCalls += 1;
          return [{ role: 'user', content: '差旅住宿标准' }];
        },
        retrieve: async ({ question }) => {
          retrieveQ = question;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: async (purpose, messages) => {
          purposes.push(purpose);
          return happyChat(purpose, messages);
        },
      }),
    );
    expect(purposes).not.toContain('rewrite');
    expect(loaderCalls).toBe(0);
    expect(retrieveQ).toBe('那餐补呢？');
    expect(r.rewriteUsed).toBe(false);
    expect(r.reason).toBe('verified');
  });

  it('on + window + weak coref: retrieve gets standalone; rewriteUsed=true', async () => {
    let retrieveQ = '';
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: '差旅住宿标准是什么？' },
          { role: 'assistant', content: '住宿上限 500 元。' },
        ],
        retrieve: async ({ question }) => {
          retrieveQ = question;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: rewriteHappyChat,
      }),
    );
    expect(retrieveQ).toBe(STANDALONE);
    expect(retrieveQ).not.toBe('那餐补呢？');
    expect(r.rewriteUsed).toBe(true);
    expect(r.standaloneQuestion).toBe(STANDALONE);
    expect(r.debug?.llmCalls).toBe(4);
    expect(r.reason).toBe('verified');
  });

  it('on + resolved=false → coref_unresolved; retrieve 0 times', async () => {
    let retrieveCount = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那个呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        retrieve: async () => {
          retrieveCount += 1;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: scriptedChat({
          rewrite: JSON.stringify({ standalone: '无法消解', resolved: false }),
        }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'coref_unresolved' });
    expect(retrieveCount).toBe(0);
    expect(r.rewriteUsed).toBe(false);
  });

  it('on + illegal JSON → coref_unresolved; retrieve 0 times', async () => {
    let retrieveCount = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那个呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        retrieve: async () => {
          retrieveCount += 1;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: scriptedChat({ rewrite: 'not-json-at-all' }),
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'coref_unresolved' });
    expect(retrieveCount).toBe(0);
  });

  it('J2x: loader only called with current sessionId; retrieve must not contain A window', async () => {
    const seen: string[] = [];
    let retrieveQ = '';
    const r = await runAskGraph(
      baseInput({ sessionId: SID_B, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async ({ sessionId }) => {
          seen.push(sessionId);
          expect(sessionId).toBe(SID_B);
          return [{ role: 'user', content: 'B会话差旅标准' }];
        },
        retrieve: async ({ question }) => {
          retrieveQ = question;
          expect(question).not.toContain(HIST_A);
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: rewriteHappyChat,
      }),
    );
    expect(seen).toEqual([SID_B]);
    expect(retrieveQ).not.toContain(HIST_A);
    expect(JSON.stringify(r.evidence_snapshot)).not.toContain(HIST_A);
    expect(r.rewriteUsed).toBe(true);
  });

  it('history text never enters evidence / evidence_snapshot', async () => {
    const HIST = '会话里的秘密数字999天年假';
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [
          { role: 'user', content: HIST },
          { role: 'assistant', content: '根据聊天年假999天' },
        ],
        chat: rewriteHappyChat,
      }),
    );
    const texts = r.evidence_snapshot.map((e) => e.text);
    expect(texts.join('\0')).not.toContain(HIST);
    expect(texts.join('\0')).not.toContain('999天年假');
    expect(JSON.stringify(r.citations)).not.toContain(HIST);
    expect(r.reason).toBe('verified');
  });

  it('no session / empty window / fast: no rewrite', async () => {
    const cases: Array<{
      name: string;
      over: Partial<AskGraphInput>;
      window?: { role: 'user' | 'assistant'; content: string }[];
    }> = [
      { name: 'no session', over: { sessionId: null, question: '那餐补呢？' } },
      { name: 'empty window', over: { sessionId: SID, question: '那餐补呢？' }, window: [] },
      { name: 'fast', over: { sessionId: SID, mode: 'fast', question: '那餐补呢？' } },
    ];

    for (const c of cases) {
      const purposes: string[] = [];
      let loaderCalls = 0;
      const r = await runAskGraph(
        baseInput(c.over),
        deps({
          rewriteEnabled: true,
          loadSessionWindow: async () => {
            loaderCalls += 1;
            return c.window ?? [{ role: 'user', content: '差旅' }];
          },
          chat: async (purpose, messages) => {
            purposes.push(purpose);
            return happyChat(purpose, messages);
          },
        }),
      );
      expect(purposes, c.name).not.toContain('rewrite');
      expect(r.rewriteUsed, c.name).toBe(false);
      if (c.name === 'no session' || c.name === 'fast') {
        expect(loaderCalls, c.name).toBe(0);
      }
      if (c.name === 'empty window') {
        expect(loaderCalls).toBe(1);
      }
    }
  });

  it('should rewrite but budget 0 → budget_exhausted', async () => {
    let retrieveCount = 0;
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '那餐补呢？' }),
      deps({
        rewriteEnabled: true,
        loadSessionWindow: async () => [{ role: 'user', content: '差旅住宿' }],
        retrieve: async () => {
          retrieveCount += 1;
          return {
            ok: true,
            evidence: evidenceOk,
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          };
        },
        chat: rewriteHappyChat,
        budgetOverride: { maxLLMCalls: 0, maxRetrieveCalls: 6 },
      }),
    );
    expect(r).toMatchObject({ status: 'abstained', reason: 'budget_exhausted' });
    expect(retrieveCount).toBe(0);
  });

  it('enabled but no loader: skip rewrite, no 500', async () => {
    const purposes: string[] = [];
    const r = await runAskGraph(
      baseInput({ sessionId: SID, question: '年假有多少天？' }),
      deps({
        rewriteEnabled: true,
        chat: async (purpose, messages) => {
          purposes.push(purpose);
          return happyChat(purpose, messages);
        },
      }),
    );
    expect(purposes).not.toContain('rewrite');
    expect(r.rewriteUsed).toBe(false);
    expect(r.reason).toBe('verified');
  });
});
