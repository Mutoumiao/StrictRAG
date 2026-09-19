/**
 * 目标：库内 verified 轮在 POST /ask 同步与 SSE 终态里都必须带 answerKind=knowledge，寒暄轮 chitchat，拒答轮不得谎报 knowledge。
 * 需求：剧本 A3 · P2必签 · prds/05-api
 * 被测：POST /knowledge-bases/:kbId/ask（sync / SSE）· runAskGraph 终态映射
 * 简介：真图 + mock 检索/网关；同步与 data-ask-final 同判 answerKind。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { baseInput, CHUNK, deps as graphDeps, happyChat, type GraphDeps } from './_support/graph-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

async function token() {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'web',
    roles: ['web_consumer'],
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp(members: Set<string>, deps: GraphDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
      settingsRepo: { get: async () => null, update: async () => null },
      execute: async (params) => {
        const { executeAsk } = await import('../../src/services/ask/execute.js');
        return executeAsk(params, { skipTrace: true, graphDeps: deps });
      },
      resolveOwnedSession: async () => true,
    }),
  );
  return app;
}

async function askSync(
  app: Hono<{ Variables: AuthVariables }>,
  accessToken: string,
  body: Record<string, unknown>,
) {
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { data: Record<string, unknown> };
}

async function askSse(
  app: Hono<{ Variables: AuthVariables }>,
  accessToken: string,
  question: string,
) {
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({ question, options: { stream: true } }),
  });
  expect(res.status).toBe(200);
  const text = await res.text();
  const chunks = text
    .split('\n')
    .filter((l) => l.startsWith('data: '))
    .map((l) => {
      try {
        return JSON.parse(l.slice(6)) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Record<string, unknown>[];
  const final = chunks.find((o) => o.type === 'data-ask-final');
  expect(final).toBeTruthy();
  return final!.data as Record<string, unknown>;
}

describe('answerKind on POST /ask', () => {
  it('A3: 库内 verified 轮同步与 SSE 都回 answerKind=knowledge 且带 citation', async () => {
    const { userId, accessToken } = await token();
    const app = buildApp(new Set([userId]), graphDeps({ chat: happyChat }));

    const sync = await askSync(app, accessToken, {
      question: baseInput().question,
      options: { stream: false },
    });
    expect(sync.data.status).toBe('answered');
    expect(sync.data.reason).toBe('verified');
    expect(sync.data.answerKind).toBe('knowledge');
    const citations = sync.data.citations as { chunkId: string }[];
    expect(citations[0]?.chunkId).toBe(CHUNK);

    const final = await askSse(app, accessToken, baseInput().question);
    expect(final.status).toBe('answered');
    expect(final.reason).toBe('verified');
    expect(final.answerKind).toBe('knowledge');
    expect(final.answerKind).toBe(sync.data.answerKind);
  });

  it('寒暄轮 answerKind=chitchat，不得冒充 knowledge', async () => {
    const { userId, accessToken } = await token();
    const app = buildApp(new Set([userId]), graphDeps({ chat: happyChat }));

    const sync = await askSync(app, accessToken, { question: '你好' });
    expect(sync.data.status).toBe('answered');
    expect(sync.data.answerKind).toBe('chitchat');
    expect(sync.data.citations).toEqual([]);

    const final = await askSse(app, accessToken, '你好');
    expect(final.answerKind).toBe('chitchat');
    expect(final.citations).toEqual([]);
  });

  it('拒答轮不下发 answerKind（空答案不得标 knowledge）', async () => {
    const { userId, accessToken } = await token();
    const app = buildApp(
      new Set([userId]),
      graphDeps({
        chat: happyChat,
        retrieve: async () => ({ ok: false, reason: 'low_retrieval' }),
      }),
    );

    const sync = await askSync(app, accessToken, { question: baseInput().question });
    expect(sync.data.status).toBe('abstained');
    expect(sync.data.answer).toBe('');
    expect(sync.data.answerKind).toBeUndefined();

    const final = await askSse(app, accessToken, baseInput().question);
    expect(final.status).toBe('abstained');
    expect(final.answerKind).toBeUndefined();
  });
});
