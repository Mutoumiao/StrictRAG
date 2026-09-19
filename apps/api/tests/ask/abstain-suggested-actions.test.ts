/**
 * 目标：拒答轮必须给出非空且随 reason 变化的 suggestedActions（同步与 SSE 同形），不得空手拒答。
 * 需求：剧本 A4 · P2必签 · prds/08-quality/01-verification-and-abstention.md
 * 被测：POST /knowledge-bases/:kbId/ask（sync / SSE）· reasonPresentation 接线
 * 简介：low_retrieval / kb_not_ready / rerank_unavailable 三种拒答各有主按钮，且互不相同。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { baseInput, deps as graphDeps, happyChat, type GraphDeps } from './_support/graph-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

type Action = { type: string; label: string };

const CASES: Array<{ reason: 'low_retrieval' | 'kb_not_ready' | 'rerank_unavailable'; action: string }> = [
  { reason: 'low_retrieval', action: 'rephrase' },
  { reason: 'kb_not_ready', action: 'contact_admin' },
  { reason: 'rerank_unavailable', action: 'retry_later' },
];

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

async function askSync(app: Hono<{ Variables: AuthVariables }>, accessToken: string) {
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
    body: JSON.stringify({ question: baseInput().question }),
  });
  expect(res.status).toBe(200);
  return (await res.json()) as { data: { status: string; reason: string; userMessage?: string; suggestedActions: Action[] } };
}

async function askSse(app: Hono<{ Variables: AuthVariables }>, accessToken: string) {
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({ question: baseInput().question, options: { stream: true } }),
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
  return final!.data as { status: string; reason: string; suggestedActions: Action[] };
}

describe('abstained suggestedActions', () => {
  it('A4: 三种拒答 reason 的 suggestedActions 都非空且互不相同（同步=SSE）', async () => {
    const { userId, accessToken } = await token();
    const seen: string[] = [];

    for (const c of CASES) {
      const app = buildApp(
        new Set([userId]),
        graphDeps({
          chat: happyChat,
          retrieve: async () => ({ ok: false, reason: c.reason }),
        }),
      );

      const sync = await askSync(app, accessToken);
      expect(sync.data.status).toBe('abstained');
      expect(sync.data.reason).toBe(c.reason);
      expect(sync.data.suggestedActions.length).toBeGreaterThan(0);
      expect(sync.data.suggestedActions.map((a) => a.type)).toContain(c.action);
      for (const a of sync.data.suggestedActions) {
        expect(a.type).toBeTruthy();
        expect(a.label).toBeTruthy();
      }
      expect(sync.data.userMessage).toBeTruthy();

      const final = await askSse(app, accessToken);
      expect(final.status).toBe('abstained');
      expect(final.reason).toBe(c.reason);
      expect(JSON.stringify(final.suggestedActions)).toBe(
        JSON.stringify(sync.data.suggestedActions),
      );

      seen.push(JSON.stringify(sync.data.suggestedActions));
    }

    // 随 reason 变：三条拒答不得复用同一组按钮
    expect(new Set(seen).size).toBe(CASES.length);
  });
});
