import { describe, expect, it, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { createAskRoutes } from '../routes/ask.js';
import type { ExecuteAskResult } from '../services/ask/index.js';
import {
  checkFixedWindowRateLimit,
  clearTraceRecords,
  createMemoryTracer,
  getTraceRecord,
  metricGet,
  metricsReset,
  recordAskResult,
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
    const rec = getTraceRecord(requestId);
    expect(rec).toBeTruthy();
    const names = rec!.spans.map((s) => s.name);
    expect(names).toContain('ask.route');
    expect(names).toContain('ask.finalize');
    expect(rec!.scores.reason_code).toBe('chitchat');
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
