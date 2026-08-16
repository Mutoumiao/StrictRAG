import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { createAskRoutes } from '../routes/ask.js';
import type { ExecuteAskResult } from '../services/ask/index.js';
import { createMemorySessionsRepo } from '../services/sessions.js';
import {
  checkFixedWindowRateLimit,
  clearTraceRecords,
  createMemoryTracer,
  getTraceRecord,
  metricGet,
  metricsReset,
  recordAskResult,
  recordL3Ask,
  recordLlmCall,
  recordRerank,
  resetRateLimitStore,
} from './index.js';

const KB = '01900000-0000-7000-8000-0000000000aa';

beforeEach(() => {
  metricsReset();
  clearTraceRecords();
  resetRateLimitStore();
});

describe('metrics skeleton', () => {
  it('ask_total / llm_call / rerank 可聚合', () => {
    recordAskResult({ status: 'answered', reason: 'verified', ok: true });
    recordAskResult({ status: 'abstained', reason: 'low_retrieval', ok: false });
    recordLlmCall('generate', true);
    recordLlmCall('judge', false);
    recordRerank(true);
    recordRerank(false, 'timeout');

    expect(metricGet('ask_total', { status: 'answered', reason: 'verified' })).toBe(1);
    expect(metricGet('ask_fail', { reason: 'low_retrieval' })).toBe(1);
    expect(metricGet('llm_call_total', { purpose: 'generate', ok: 'true' })).toBe(1);
    expect(metricGet('llm_call_total', { purpose: 'judge', ok: 'false' })).toBe(1);
    expect(metricGet('rerank_total', { ok: 'true' })).toBe(1);
    expect(metricGet('rerank_total', { ok: 'false', kind: 'timeout' })).toBe(1);
  });
});

describe('recordL3Ask', () => {
  it('rewriteUsed true +1；false 不加', () => {
    recordL3Ask({ rewriteUsed: true, reason: 'verified', hasSession: false });
    expect(metricGet('l3_rewrite_used_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    expect(metricGet('l3_rewrite_used_total')).toBe(1);
  });

  it('reason=coref_unresolved +1；其它 reason 不加', () => {
    recordL3Ask({ rewriteUsed: false, reason: 'coref_unresolved', hasSession: false });
    expect(metricGet('l3_coref_fail_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    expect(metricGet('l3_coref_fail_total')).toBe(1);
  });

  it('hasSession true +1；false 不加', () => {
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    expect(metricGet('l3_session_ask_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: false });
    expect(metricGet('l3_session_ask_total')).toBe(1);
  });

  it('sessionDeepened true +1；缺省/false 不加', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      sessionDeepened: true,
    });
    expect(metricGet('l3_session_deepened_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      sessionDeepened: false,
    });
    expect(metricGet('l3_session_deepened_total')).toBe(1);
  });

  it('documentBackref true +1；缺省/false 不加', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      documentBackref: true,
    });
    expect(metricGet('l3_document_backref_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      documentBackref: false,
    });
    expect(metricGet('l3_document_backref_total')).toBe(1);
  });

  it('externalBackref true +1；缺省/false 不加', () => {
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      externalBackref: true,
    });
    expect(metricGet('l3_external_backref_total')).toBe(1);
    recordL3Ask({ rewriteUsed: false, reason: 'verified', hasSession: true });
    recordL3Ask({
      rewriteUsed: false,
      reason: 'verified',
      hasSession: true,
      externalBackref: false,
    });
    expect(metricGet('l3_external_backref_total')).toBe(1);
  });

  it('metricsReset 后为 0', () => {
    recordL3Ask({
      rewriteUsed: true,
      reason: 'coref_unresolved',
      hasSession: true,
      sessionDeepened: true,
      documentBackref: true,
      externalBackref: true,
    });
    metricsReset();
    expect(metricGet('l3_rewrite_used_total')).toBe(0);
    expect(metricGet('l3_coref_fail_total')).toBe(0);
    expect(metricGet('l3_session_ask_total')).toBe(0);
    expect(metricGet('l3_session_deepened_total')).toBe(0);
    expect(metricGet('l3_document_backref_total')).toBe(0);
    expect(metricGet('l3_external_backref_total')).toBe(0);
  });
});

describe('memory tracer (Langfuse mock exporter)', () => {
  it('记录主链 span 与 scores', () => {
    const t = createMemoryTracer('req-obs-1', { kbId: KB });
    t.startSpan('ask.route').end({ routeLabel: 'single' });
    t.startSpan('ask.retrieve').end({ count: 2 });
    t.startSpan('ask.generate').end();
    t.startSpan('ask.claim_split').end();
    t.startSpan('ask.verify').end({ minSupport: 0.9 });
    t.startSpan('ask.finalize').end({ status: 'answered' });
    t.endTrace({
      answered: true,
      min_support: 0.9,
      reason_code: 'verified',
      latency_ms: 12,
    });

    const rec = getTraceRecord('req-obs-1');
    expect(rec).toBeTruthy();
    expect(rec!.name).toBe('kb.ask');
    expect(rec!.spans.map((s) => s.name)).toEqual([
      'ask.route',
      'ask.retrieve',
      'ask.generate',
      'ask.claim_split',
      'ask.verify',
      'ask.finalize',
    ]);
    expect(rec!.scores.reason_code).toBe('verified');
    expect(rec!.scores.answered).toBe(true);
  });
});

describe('rate limit', () => {
  it('超限返回 retryAfter', () => {
    const store = new Map<string, { count: number; windowStart: number }>();
    const now = { t: 1_000_000 };
    const opts = {
      limit: 2,
      windowMs: 60_000,
      store,
      now: () => now.t,
    };
    expect(checkFixedWindowRateLimit('k', opts).ok).toBe(true);
    expect(checkFixedWindowRateLimit('k', opts).ok).toBe(true);
    const third = checkFixedWindowRateLimit('k', opts);
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterSec).toBeGreaterThan(0);
  });

  it('limit=0 不限流', () => {
    expect(checkFixedWindowRateLimit('x', { limit: 0 }).ok).toBe(true);
  });
});

describe('ask route 429 RATE_LIMITED', () => {
  async function token(roles: string[], userId = uuidv7()) {
    const pair = await issueTokenPair({
      userId,
      app: 'web',
      roles,
      email: `${userId.slice(0, 8)}@test.local`,
      tenantId: '01900000-0000-7000-8000-000000000001',
    });
    return { userId, accessToken: pair.accessToken };
  }

  it('限流触发 → 429 + RATE_LIMITED', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    let calls = 0;
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route(
      '/api/v1',
      createAskRoutes({
        resolveKbMember: async (uid, kbId) => kbId === KB && uid === userId,
        getKb: async () => ({
          id: KB,
          tenantId: '01900000-0000-7000-8000-000000000001',
        }),
        checkRateLimit: () => {
          calls += 1;
          if (calls === 1) return { ok: true, remaining: 0 };
          return { ok: false, remaining: 0, retryAfterSec: 42 };
        },
        execute: async (): Promise<ExecuteAskResult> => ({
          httpStatus: 200,
          response: {
            requestId: 'r',
            status: 'answered',
            answer: 'ok',
            citations: [],
            reason: 'verified',
            suggestedActions: [],
            sessionId: null,
          },
          graph: {
            requestId: 'r',
            status: 'answered',
            answer: 'ok',
            citations: [],
            reason: 'verified',
            suggestedActions: [],
            mode: 'balanced',
            rewriteUsed: false,
            sessionDeepened: false,
            evidence_snapshot: [],
          },
        }),
      }),
    );

    const okRes = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'q1', options: { stream: false } }),
    });
    expect(okRes.status).toBe(200);

    const limited = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'q2', options: { stream: false } }),
    });
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as { error: { code: string; details?: { retryAfterSec: number } } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.details?.retryAfterSec).toBe(42);
  });
});

describe('executeAsk wires tracer spans', () => {
  it('chitchat 路径留下 route+finalize', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const requestId = `req-chitchat-${uuidv7().slice(0, 8)}`;
    const result = await executeAsk(
      {
        requestId,
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: { question: '你好', options: { mode: 'balanced' } },
      },
      {
        skipTrace: true,
        graphDeps: {
          chat: async () => {
            throw new Error('should not call chat on chitchat');
          },
          // 无 tracer：execute 注入 memory
        },
      },
    );
    expect(result.response.reason).toBe('chitchat');
    expect(metricGet('l3_session_ask_total')).toBe(0);
    expect(metricGet('l3_rewrite_used_total')).toBe(0);
    const rec = getTraceRecord(requestId);
    expect(rec).toBeTruthy();
    const names = rec!.spans.map((s) => s.name);
    expect(names).toContain('ask.route');
    expect(names).toContain('ask.finalize');
    expect(rec!.scores.reason_code).toBe('chitchat');
  });

  it('带 sessionId 计 l3_session_ask_total（skipTrace 也计）', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    await executeAsk(
      {
        requestId: `req-l3-sess-${uuidv7().slice(0, 8)}`,
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: {
          question: '你好',
          sessionId: uuidv7(),
          options: { mode: 'balanced' },
        },
      },
      {
        skipTrace: true,
        graphDeps: {
          chat: async () => {
            throw new Error('should not call chat on chitchat');
          },
        },
      },
    );
    expect(metricGet('l3_session_ask_total')).toBe(1);
    expect(metricGet('l3_rewrite_used_total')).toBe(0);
    expect(metricGet('l3_coref_fail_total')).toBe(0);
    expect(metricGet('l3_document_backref_total')).toBe(0);
  });

  it('document backref + last evidence → preferred + l3_document_backref_total（不加深）', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const userId = uuidv7();
    const mem = createMemorySessionsRepo();
    const sess = await mem.create({
      kbId: KB,
      tenantId: '01900000-0000-7000-8000-000000000001',
      userId,
    });
    const DOC = '22222222-2222-7222-8222-222222222222';
    const CHUNK = '11111111-1111-7111-8111-111111111111';
    mem.appendTrace({
      sessionId: sess.sessionId,
      kbId: KB,
      userId,
      requestId: 'prev',
      question: '年假',
      answer: '15天',
      status: 'answered',
      reason: 'verified',
      evidenceDocIds: [DOC],
    });
    let seenPreferred: readonly string[] | undefined;
    const result = await executeAsk(
      {
        requestId: `req-doc-${uuidv7().slice(0, 8)}`,
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId,
        membership: 'member',
        body: {
          question: '这份文档的适用范围是什么',
          sessionId: sess.sessionId,
          options: { mode: 'balanced', debug: true },
        },
      },
      {
        skipTrace: true,
        sessions: mem,
        graphDeps: {
          retrieve: async ({ preferredDocIds }) => {
            seenPreferred = preferredDocIds;
            return {
              ok: true,
              evidence: [
                {
                  chunkId: CHUNK,
                  docId: DOC,
                  title: '制度',
                  text: '适用范围为本公司',
                  preview: '适用范围',
                  lifecycle: 'active',
                  score: 0.9,
                },
              ],
              meta: {
                esMode: 'mock',
                candidateCount: 1,
                denseHits: 1,
                sparseHits: 1,
                preferredAdopted: true,
              },
            };
          },
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '适用范围为本公司。',
                citations: [CHUNK],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({
                claims: [{ text: '适用范围为本公司', chunkIds: [CHUNK] }],
              });
            }
            if (purpose === 'judge') {
              return JSON.stringify({ scores: [0.95] });
            }
            throw new Error(`unexpected ${purpose}`);
          },
        },
      },
    );
    expect(seenPreferred).toEqual([DOC]);
    expect(result.graph.documentBackref).toBe(true);
    expect(result.graph.sessionDeepened).toBe(false);
    expect(result.response.debug?.documentBackref).toBe(true);
    expect(metricGet('l3_document_backref_total')).toBe(1);
  });

  it('external backref + last evidence → 不查 preferred；l3_external_backref_total', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const userId = uuidv7();
    const mem = createMemorySessionsRepo();
    const sess = await mem.create({
      kbId: KB,
      tenantId: '01900000-0000-7000-8000-000000000001',
      userId,
    });
    const DOC = '22222222-2222-7222-8222-222222222222';
    const CHUNK = '11111111-1111-7111-8111-111111111111';
    mem.appendTrace({
      sessionId: sess.sessionId,
      kbId: KB,
      userId,
      requestId: 'prev',
      question: '年假',
      answer: '15天',
      status: 'answered',
      reason: 'verified',
      evidenceDocIds: [DOC],
    });
    let listed = 0;
    const sessions = {
      ...mem,
      listLastEvidenceDocIds: async (
        input: Parameters<typeof mem.listLastEvidenceDocIds>[0],
      ) => {
        listed += 1;
        return mem.listLastEvidenceDocIds(input);
      },
    };
    let seenPreferred: readonly string[] | undefined = ['sentinel'];
    const result = await executeAsk(
      {
        requestId: `req-ext-${uuidv7().slice(0, 8)}`,
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId,
        membership: 'member',
        body: {
          question: '网上那份文件怎么说',
          sessionId: sess.sessionId,
          options: { mode: 'balanced', debug: true },
        },
      },
      {
        skipTrace: true,
        sessions,
        graphDeps: {
          retrieve: async ({ preferredDocIds }) => {
            seenPreferred = preferredDocIds;
            return {
              ok: true,
              evidence: [
                {
                  chunkId: CHUNK,
                  docId: DOC,
                  title: '制度',
                  text: '适用范围为本公司',
                  preview: '适用范围',
                  lifecycle: 'active',
                  score: 0.9,
                },
              ],
              meta: {
                esMode: 'mock',
                candidateCount: 1,
                denseHits: 1,
                sparseHits: 1,
                preferredAdopted: true,
              },
            };
          },
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '适用范围为本公司。',
                citations: [CHUNK],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({
                claims: [{ text: '适用范围为本公司', chunkIds: [CHUNK] }],
              });
            }
            if (purpose === 'judge') {
              return JSON.stringify({ scores: [0.95] });
            }
            throw new Error(`unexpected ${purpose}`);
          },
        },
      },
    );
    expect(listed).toBe(0);
    expect(seenPreferred).toBeUndefined();
    expect(result.graph.externalBackref).toBe(true);
    expect(result.graph.documentBackref).toBe(false);
    expect(result.graph.sessionDeepened).toBe(false);
    expect(result.response.debug?.externalBackref).toBe(true);
    expect(result.response.debug?.documentBackref).toBe(false);
    expect(metricGet('l3_external_backref_total')).toBe(1);
    expect(metricGet('l3_document_backref_total')).toBe(0);
  });

  it('knowledge happy path records route→retrieve→generate→claim_split→verify→finalize', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const CHUNK = '11111111-1111-7111-8111-111111111111';
    const DOC = '22222222-2222-7222-8222-222222222222';
    const requestId = `req-know-${uuidv7().slice(0, 8)}`;
    const result = await executeAsk(
      {
        requestId,
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: { question: '年假有多少天？', options: { mode: 'balanced' } },
      },
      {
        skipTrace: true,
        graphDeps: {
          retrieve: async () => ({
            ok: true,
            evidence: [
              {
                chunkId: CHUNK,
                docId: DOC,
                title: '休假',
                text: '员工年假为15天',
                preview: '15天',
                lifecycle: 'active',
                score: 0.9,
              },
            ],
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          }),
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '年假为15天。',
                citations: [CHUNK],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({ claims: [{ text: '年假为15天', chunkIds: [CHUNK] }] });
            }
            if (purpose === 'judge') {
              return JSON.stringify({ scores: [0.95] });
            }
            throw new Error(`unexpected ${purpose}`);
          },
        },
      },
    );
    expect(result.response.status).toBe('answered');
    expect(result.response.reason).toBe('verified');
    const rec = getTraceRecord(requestId);
    expect(rec).toBeTruthy();
    const names = rec!.spans.map((s) => s.name);
    for (const need of [
      'ask.route',
      'ask.retrieve',
      'ask.generate',
      'ask.claim_split',
      'ask.verify',
      'ask.finalize',
    ]) {
      expect(names, `missing span ${need}`).toContain(need);
    }
  });
});
