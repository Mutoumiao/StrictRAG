/**
 * 目标：POST ask 校验、鉴权与 sessionId 闸必须按契约拒绝非法请求。
 * 需求：prds/05-api
 * 被测：POST /knowledge-bases/:kbId/ask
 * 简介：非法 body、无鉴权与非法 sessionId 须按契约拒绝。
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
