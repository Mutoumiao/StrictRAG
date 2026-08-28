/**
 * 目标：同步与 SSE 终态字段必须一致；空库走 200 拒答；execute 抛错仍要给出 final。
 * 需求：prds/05-api
 * 被测：POST /knowledge-bases/:kbId/ask sync / SSE
 * 简介：同步与流式终态一致；kb_not_ready 为 200 拒答信封；execute 抛错仍须给出 final。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';
import { createAskRoutes } from '../../src/routes/ask.js';

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
      execute: (opts.execute as typeof import('../../src/services/ask/index.js').executeAsk) ??
        fixedExecute(sampleAnswered()),
      resolveOwnedSession: owned
        ? async ({ sessionId }) => owned.has(sessionId)
        : async () => true,
    }),
  );
  return app;
}

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

  it('kb_not_ready → 200 拒答信封（同步 + SSE）', async () => {
    const { executeAsk } = await import('../../src/services/ask/execute.js');
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      execute: (params) =>
        executeAsk(params as Parameters<typeof executeAsk>[0], {
          skipTrace: true,
          graphDeps: {
            retrieve: async () => ({
              ok: false,
              reason: 'kb_not_ready',
              message: 'no ready∧active documents in kb',
            }),
            chat: async () => {
              throw new Error('should not generate when kb_not_ready');
            },
          },
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
    expect(syncRes.status).toBe(200);
    const syncBody = (await syncRes.json()) as {
      ok: boolean;
      data: {
        status: string;
        reason: string;
        answer: string;
        userMessage?: string;
        suggestedActions: { type: string; label: string }[];
      };
      error?: { code: string };
    };
    expect(syncBody.ok).toBe(true);
    expect(syncBody.error).toBeUndefined();
    expect(syncBody.data.status).toBe('abstained');
    expect(syncBody.data.reason).toBe('kb_not_ready');
    expect(syncBody.data.answer).toBe('');
    expect(syncBody.data.userMessage).toBe(
      '知识库尚无可用文档，请稍后再试或联系管理员。',
    );
    expect(syncBody.data.suggestedActions).toEqual(
      expect.arrayContaining([{ type: 'contact_admin', label: '联系管理员' }]),
    );

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

    const statusError = chunks.find((o) => {
      if (o.type !== 'data-status' || typeof o.data !== 'object' || o.data === null) {
        return false;
      }
      const data = o.data as { phase?: string; code?: string };
      return data.phase === 'error' && data.code === 'KB_NOT_READY';
    });
    expect(statusError).toBeUndefined();

    const finalChunk = chunks.find((o) => o.type === 'data-ask-final');
    expect(finalChunk).toBeTruthy();
    const finalPayload = finalChunk!.data as {
      status: string;
      reason: string;
      userMessage?: string;
    };
    expect(finalPayload.status).toBe('abstained');
    expect(finalPayload.reason).toBe('kb_not_ready');
    expect(finalPayload.userMessage).toBe(syncBody.data.userMessage);
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
    const { executeAsk } = await import('../../src/services/ask/execute.js');
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
    const { executeAsk } = await import('../../src/services/ask/execute.js');
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
