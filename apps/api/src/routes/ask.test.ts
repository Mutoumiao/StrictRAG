import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import type { ExecuteAskResult } from '../services/ask/index.js';
import { createAskRoutes } from './ask.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';

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

function fixedExecute(result: ExecuteAskResult) {
  return async (): Promise<ExecuteAskResult> => result;
}

function sampleAnswered(requestId = 'req-test'): ExecuteAskResult {
  return {
    httpStatus: 200,
    response: {
      requestId,
      status: 'answered',
      answer: '年假为15天。',
      answerKind: 'knowledge',
      citations: [
        {
          chunkId: CHUNK,
          docId: DOC,
          title: '休假',
          preview: '15天',
          lifecycle: 'active',
        },
      ],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: '年假为15天。',
      suggestedActions: [],
      latencyMs: 12,
      mode: 'balanced',
      sessionId: null,
    },
    graph: {
      requestId,
      status: 'answered',
      answer: '年假为15天。',
      answerKind: 'knowledge',
      citations: [],
      reason: 'verified',
      suggestedActions: [],
      mode: 'balanced',
      rewriteUsed: false,
      sessionDeepened: false,
      evidence_snapshot: [
        {
          chunkId: CHUNK,
          docId: DOC,
          text: '员工年假为15天',
          preview: '15天',
          lifecycle: 'active',
          title: '休假',
        },
      ],
    },
  };
}

function buildApp(opts: {
  members?: Set<string>;
  execute?: (params: unknown) => Promise<ExecuteAskResult>;
  kbExists?: boolean;
  ownedSessions?: Set<string>;
}) {
  const members = opts.members ?? new Set<string>();
  const owned = opts.ownedSessions;
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) =>
        opts.kbExists === false || id !== KB
          ? null
          : { id: KB, tenantId: '01900000-0000-7000-8000-000000000001' },
      // 默认不打真库 settings（全量 mode 默认）；B2-W 闸测见 ask.mode-gate.test.ts
      settingsRepo: {
        get: async () => null,
        update: async () => null,
      },
      execute: (opts.execute as typeof import('../services/ask/index.js').executeAsk) ??
        fixedExecute(sampleAnswered()),
      resolveOwnedSession: owned
        ? async ({ sessionId }) => owned.has(sessionId)
        : async () => true,
    }),
  );
  return app;
}

describe('POST ask validation', () => {
  it('rejects options.tauClaim → 400', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: '年假几天',
        options: { tauClaim: 0.1, mode: 'balanced' },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects scope inside options → 400', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: '年假几天',
        options: { scope: { docTypes: ['hr'] }, mode: 'balanced' },
      }),
    });
    expect(res.status).toBe(400);
  });

  it('accepts top-level scope.docTypes', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: '年假几天',
        scope: { docTypes: ['hr'] },
        options: { mode: 'balanced', stream: false },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: { reason: string } };
    expect(body.ok).toBe(true);
    expect(body.data.reason).toBe('verified');
  });
});

describe('POST ask auth', () => {
  it('non-member → 403', async () => {
    const { accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'hi' }),
    });
    expect(res.status).toBe(403);
  });

  it('no bearer → 401', async () => {
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'hi' }),
    });
    expect(res.status).toBe(401);
  });

  it('kb missing → 404', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]), kbExists: false });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: '年假' }),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST ask sync + SSE', () => {
  it('sync 200 + AskResponse shape', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: '年假有多少天？' }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: true;
      data: {
        requestId: string;
        status: string;
        reason: string;
        citations: { chunkId: string }[];
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe('answered');
    expect(body.data.reason).toBe('verified');
    expect(body.data.citations[0]?.chunkId).toBe(CHUNK);
    expect(body.data.requestId).toBeTruthy();
  });

  it('kb_not_ready → 409', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      execute: fixedExecute({
        httpStatus: 409,
        response: {
          requestId: 'r1',
          status: 'abstained',
          answer: '',
          reason: 'kb_not_ready',
          citations: [],
          suggestedActions: [],
          mode: 'balanced',
        },
        graph: {
          requestId: 'r1',
          status: 'abstained',
          answer: '',
          reason: 'kb_not_ready',
          citations: [],
          suggestedActions: [],
          mode: 'balanced',
          rewriteUsed: false,
          sessionDeepened: false,
          evidence_snapshot: [],
        },
      }),
    });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: '年假' }),
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('KB_NOT_READY');
  });

  it('UI Message Stream data-ask-final ≡ sync critical fields', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      execute: async (params) => {
        const p = params as { requestId: string };
        return sampleAnswered(p.requestId);
      },
    });

    const syncRes = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: '年假', options: { stream: false } }),
    });
    const syncBody = (await syncRes.json()) as {
      data: {
        status: string;
        reason: string;
        answer: string;
        citations: unknown[];
        userMessage?: string;
        sessionId?: string | null;
        suggestedActions: unknown[];
      };
    };

    const sseRes = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({ question: '年假', options: { stream: true } }),
    });
    expect(sseRes.status).toBe(200);
    const text = await sseRes.text();
    expect(text).toContain('data-ask-final');
    expect(text).toContain('"type":"data-status"');

    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));
    const chunks = dataLines
      .map((d) => {
        try {
          return JSON.parse(d) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];

    const finalChunk = chunks.find((o) => o.type === 'data-ask-final');
    expect(finalChunk).toBeTruthy();
    const finalPayload = finalChunk!.data as Record<string, unknown>;
    expect(finalPayload.status).toBe(syncBody.data.status);
    expect(finalPayload.reason).toBe(syncBody.data.reason);
    expect(finalPayload.answer).toBe(syncBody.data.answer);
    expect(finalPayload.userMessage).toBe(syncBody.data.userMessage);
    expect(finalPayload.sessionId ?? null).toBe(syncBody.data.sessionId ?? null);
    expect(Array.isArray(finalPayload.citations)).toBe(true);
    expect(Array.isArray(finalPayload.suggestedActions)).toBe(true);
  });

  it('stream execute 抛错 → data-status error + data-ask-final internal_guard', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      execute: async () => {
        throw new Error('simulated execute failure');
      },
    });

    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({ question: '年假', options: { stream: true } }),
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('data-ask-final');
    expect(text).toContain('"type":"data-status"');

    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));
    const chunks = dataLines
      .map((d) => {
        try {
          return JSON.parse(d) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];

    const statusError = chunks.find(
      (o) =>
        o.type === 'data-status' &&
        typeof o.data === 'object' &&
        o.data !== null &&
        (o.data as { phase?: string }).phase === 'error',
    );
    expect(statusError).toBeTruthy();

    const finalChunk = chunks.find((o) => o.type === 'data-ask-final');
    expect(finalChunk).toBeTruthy();
    const finalPayload = finalChunk!.data as Record<string, unknown>;
    expect(finalPayload.status).toBe('abstained');
    expect(finalPayload.reason).toBe('internal_guard');
    expect(finalPayload.answer).toBe('');
    expect(Array.isArray(finalPayload.citations)).toBe(true);
    expect(finalPayload.citations).toEqual([]);
  });

  it('真实图：rerank 失败 → HTTP abstained rerank_unavailable（非 answered）', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      execute: (params) =>
        executeAsk(params as Parameters<typeof executeAsk>[0], {
          skipTrace: true,
          graphDeps: {
            retrieve: async () => ({
              ok: false,
              reason: 'rerank_unavailable',
              message: 'rerank down',
            }),
            chat: async () => {
              throw new Error('should not generate after rerank fail');
            },
          },
        }),
    });

    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: '年假几天', options: { stream: false } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { status: string; reason: string; answer: string; citations: unknown[] };
    };
    expect(body.data.status).toBe('abstained');
    expect(body.data.reason).toBe('rerank_unavailable');
    expect(body.data.answer).toBe('');
    expect(body.data.citations).toEqual([]);
  });

  it('真实图：sync 与 SSE final 字段一致（含 reason/answer/citations）', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const { userId, accessToken } = await token(['web_consumer']);
    const evidence = [
      {
        chunkId: CHUNK,
        docId: DOC,
        title: '休假',
        text: '员工年假为15天',
        preview: '15天',
        lifecycle: 'active' as const,
        score: 0.9,
      },
    ];
    const graphDeps = {
      retrieve: async () => ({
        ok: true as const,
        evidence,
        meta: { esMode: 'mock' as const, candidateCount: 1, denseHits: 1, sparseHits: 1 },
      }),
      chat: async (purpose: string) => {
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
    };
    const app = buildApp({
      members: new Set([userId]),
      execute: (params) =>
        executeAsk(params as Parameters<typeof executeAsk>[0], {
          skipTrace: true,
          graphDeps,
        }),
    });

    const syncRes = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: '年假', options: { stream: false } }),
    });
    const sync = (await syncRes.json()) as {
      data: {
        status: string;
        reason: string;
        answer: string;
        answerKind?: string;
        citations: { chunkId: string }[];
        suggestedActions: unknown[];
      };
    };
    expect(sync.data.status).toBe('answered');
    expect(sync.data.reason).toBe('verified');

    const sseRes = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
      },
      body: JSON.stringify({ question: '年假', options: { stream: true } }),
    });
    const text = await sseRes.text();
    expect(text).toContain('data-ask-final');
    const dataLines = text
      .split('\n')
      .filter((l) => l.startsWith('data: '))
      .map((l) => l.slice(6));
    const chunks = dataLines
      .map((d) => {
        try {
          return JSON.parse(d) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Record<string, unknown>[];
    const finalChunk = chunks.find((o) => o.type === 'data-ask-final');
    expect(finalChunk).toBeTruthy();
    const finalPayload = finalChunk!.data as Record<string, unknown>;

    expect(finalPayload.status).toBe(sync.data.status);
    expect(finalPayload.reason).toBe(sync.data.reason);
    expect(finalPayload.answer).toBe(sync.data.answer);
    expect(finalPayload.answerKind).toBe(sync.data.answerKind);
    expect(JSON.stringify(finalPayload.citations)).toBe(JSON.stringify(sync.data.citations));
    expect(JSON.stringify(finalPayload.suggestedActions)).toBe(
      JSON.stringify(sync.data.suggestedActions),
    );
  });
});

describe('executeAsk trace + graph wiring', () => {
  it('saves evidence_snapshot without session history text', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const saved: { evidenceSnapshot: { preview?: string; chunkId: string }[]; rawQuestion: string }[] =
      [];
    const CHUNK_ID = CHUNK;
    const result = await executeAsk(
      {
        requestId: 'req-trace-1',
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: {
          question: '年假有多少天？',
          sessionId: null,
          options: { mode: 'balanced' },
        },
      },
      {
        graphDeps: {
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '年假为15天。',
                citations: [CHUNK_ID],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({
                claims: [{ text: '年假为15天', chunkIds: [CHUNK_ID] }],
              });
            }
            return JSON.stringify({ scores: [0.95] });
          },
          retrieve: async () => ({
            ok: true,
            evidence: [
              {
                chunkId: CHUNK_ID,
                docId: DOC,
                title: '休假',
                text: '员工年假为15天，须提前申请。',
                preview: '员工年假为15天',
                lifecycle: 'active',
                score: 0.9,
              },
            ],
            meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
          }),
        },
        saveTrace: async (input) => {
          saved.push({
            evidenceSnapshot: input.evidenceSnapshot,
            rawQuestion: input.rawQuestion,
          });
          return { id: 't1' };
        },
      },
    );

    expect(result.httpStatus).toBe(200);
    expect(result.response.reason).toBe('verified');
    expect(saved).toHaveLength(1);
    expect(saved[0]!.rawQuestion).toBe('年假有多少天？');
    expect(saved[0]!.evidenceSnapshot[0]?.chunkId).toBe(CHUNK_ID);
    // 快照不含会话闲聊/历史
    const blob = JSON.stringify(saved[0]!.evidenceSnapshot);
    expect(blob).not.toMatch(/刚才|历史会话|session history/i);
  });

  it('带 sessionId 落 trace 时 rewriteUsed=false，历史文不进 evidence', async () => {
    const { executeAsk } = await import('../services/ask/execute.js');
    const SID = '33333333-3333-7333-8333-333333333333';
    const HISTORY_LEAK = '上一轮会话里的 Vue 秘密答案';
    const saved: {
      sessionId?: string | null;
      evidenceSnapshot: unknown[];
      configSnap?: Record<string, unknown>;
      rewriteUsedField?: number;
    }[] = [];

    const result = await executeAsk(
      {
        requestId: 'req-sess-1',
        kbId: KB,
        tenantId: '01900000-0000-7000-8000-000000000001',
        userId: uuidv7(),
        membership: 'member',
        body: {
          question: '年假几天',
          sessionId: SID,
          options: { mode: 'balanced', debug: true },
        },
      },
      {
        graphDeps: {
          chat: async (purpose) => {
            if (purpose === 'generate') {
              return JSON.stringify({
                answer: '15天',
                citations: [CHUNK],
                insufficient: false,
              });
            }
            if (purpose === 'claim_split') {
              return JSON.stringify({ claims: [{ text: '15天', chunkIds: [CHUNK] }] });
            }
            return JSON.stringify({ scores: [0.95] });
          },
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
        },
        saveTrace: async (input) => {
          saved.push({
            sessionId: input.sessionId,
            evidenceSnapshot: input.evidenceSnapshot,
            configSnap: input.configSnap,
          });
          // 模拟「若错误地把历史塞进 evidence」的检测：保证我们没塞
          expect(JSON.stringify(input.evidenceSnapshot)).not.toContain(HISTORY_LEAK);
          return { id: 't2' };
        },
      },
    );

    expect(result.httpStatus).toBe(200);
    expect(result.response.sessionId).toBe(SID);
    expect(result.response.debug?.rewriteUsed).toBe(false);
    expect(saved[0]?.sessionId).toBe(SID);
    expect(saved[0]?.configSnap?.sessionRewriteEnabledDefault).toBe(false);
    // 历史原文不得出现在 evidence 或 citations
    const evidenceBlob = JSON.stringify(saved[0]?.evidenceSnapshot);
    expect(evidenceBlob).not.toContain(HISTORY_LEAK);
    expect(JSON.stringify(result.response.citations)).not.toContain(HISTORY_LEAK);
  });
});

describe('POST ask sessionId gate', () => {
  it('未知 sessionId → 404', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      ownedSessions: new Set(),
    });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: 'hi',
        sessionId: '33333333-3333-7333-8333-333333333333',
        options: { stream: false },
      }),
    });
    expect(res.status).toBe(404);
  });

  it('合法 sessionId 回显且主路径 200', async () => {
    const SID = '33333333-3333-7333-8333-333333333333';
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      ownedSessions: new Set([SID]),
      execute: async (params) => {
        const p = params as { requestId: string; body: { sessionId?: string | null } };
        const base = sampleAnswered(p.requestId);
        return {
          ...base,
          response: { ...base.response, sessionId: p.body.sessionId ?? null },
          graph: { ...base.graph, sessionId: p.body.sessionId ?? null },
        };
      },
    });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: '年假',
        sessionId: SID,
        options: { stream: false, debug: true },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { sessionId: string | null } };
    expect(body.data.sessionId).toBe(SID);
  });
});
