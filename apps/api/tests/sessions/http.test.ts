/**
 * 目标：会话壳 HTTP 可用；列表分页与越界按契约；在 B 会话发问时近窗与历史窗不得含 A 的文本。
 * 需求：剧本 U2 · 剧本 U5 · 历史≠evidence · rewrite 默认关
 * 被测：createSessionRoutes · createAskRoutes（executeAsk 近窗装载）
 * 简介：多会话建/列/详情、limit/offset 分页边界；B 会话 ask 的近窗只取本 session transcript。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import type { GraphDeps } from '../../src/graph/run.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes, type AskRouteDeps } from '../../src/routes/ask.js';
import {
  createMemorySessionsRepo,
  type SessionsRepo,
} from '../../src/services/sessions.js';
import { createSessionRoutes } from '../../src/routes/sessions.js';
import {
  evidenceOk,
  rewriteHappyChat,
  type GraphChat,
} from '../ask/_support/graph-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: 'web',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp(opts: {
  members?: Set<string>;
  sessions?: SessionsRepo;
  kbExists?: boolean;
  askExecute?: AskRouteDeps['execute'];
}) {
  const members = opts.members ?? new Set<string>();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createSessionRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) =>
        opts.kbExists === false || id !== KB ? null : { id: KB, tenantId: TENANT },
      sessions: opts.sessions,
    }),
  );
  if (opts.askExecute) {
    const repo = opts.sessions;
    app.route(
      '/api/v1',
      createAskRoutes({
        resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
        getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
        settingsRepo: { get: async () => null, update: async () => null },
        execute: opts.askExecute,
        resolveOwnedSession: async ({ sessionId, kbId, userId }) => {
          if (!repo) return false;
          return Boolean(await repo.getOwned({ sessionId, kbId, userId }));
        },
      }),
    );
  }
  return app;
}

describe('sessions shell routes', () => {
  it('U1/U2: 成员可建多会话并列表', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const mem = createMemorySessionsRepo();
    const app = buildApp({ members: new Set([userId]), sessions: mem });

    const a = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'A' }),
    });
    expect(a.status).toBe(201);
    const aBody = (await a.json()) as { data: { sessionId: string; title: string } };
    expect(aBody.data.sessionId).toBeTruthy();
    expect(aBody.data.title).toBe('A');

    const b = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ title: 'B' }),
    });
    expect(b.status).toBe(201);
    const bBody = (await b.json()) as { data: { sessionId: string } };

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const listBody = (await list.json()) as {
      data: { items: { sessionId: string }[] };
    };
    const ids = listBody.data.items.map((i) => i.sessionId);
    expect(ids).toContain(aBody.data.sessionId);
    expect(ids).toContain(bBody.data.sessionId);
  });

  it('U4/U5: 历史仅本 session，跨会话不泄漏', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const mem = createMemorySessionsRepo();
    const app = buildApp({ members: new Set([userId]), sessions: mem });

    const mk = async (title: string) => {
      const res = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      const body = (await res.json()) as { data: { sessionId: string } };
      return body.data.sessionId;
    };

    const sidA = await mk('A');
    const sidB = await mk('B');

    mem.appendTrace({
      sessionId: sidA,
      kbId: KB,
      userId,
      requestId: 'r-a',
      question: 'Vue 相关问题',
      answer: 'Vue 答案',
      status: 'answered',
      reason: 'verified',
    });
    mem.appendTrace({
      sessionId: sidB,
      kbId: KB,
      userId,
      requestId: 'r-b',
      question: 'React 相关问题',
      answer: 'React 答案',
      status: 'answered',
      reason: 'verified',
    });

    const detA = await app.request(`/api/v1/knowledge-bases/${KB}/sessions/${sidA}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const detABody = (await detA.json()) as {
      data: { messages: { content: string }[] };
    };
    const textsA = detABody.data.messages.map((m) => m.content).join('|');
    expect(textsA).toContain('Vue');
    expect(textsA).not.toContain('React');

    const detB = await app.request(`/api/v1/knowledge-bases/${KB}/sessions/${sidB}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const detBBody = (await detB.json()) as {
      data: { messages: { content: string }[] };
    };
    const textsB = detBBody.data.messages.map((m) => m.content).join('|');
    expect(textsB).toContain('React');
    expect(textsB).not.toContain('Vue');

    // dump 级隔离
    expect(mem.dumpTraces(sidA).every((t) => t.question.includes('Vue'))).toBe(true);
    expect(mem.dumpTraces(sidB).every((t) => t.question.includes('React'))).toBe(true);
  });

  it('U7: 非成员 403', async () => {
    const { accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set(), sessions: createMemorySessionsRepo() });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect(res.status).toBe(403);
  });

  it('他人 session 详情 404', async () => {
    const u1 = await token(['web_consumer']);
    const u2 = await token(['web_consumer']);
    const mem = createMemorySessionsRepo();
    const app = buildApp({
      members: new Set([u1.userId, u2.userId]),
      sessions: mem,
    });

    const created = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${u1.accessToken}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    const sid = ((await created.json()) as { data: { sessionId: string } }).data.sessionId;

    const res = await app.request(`/api/v1/knowledge-bases/${KB}/sessions/${sid}`, {
      headers: { authorization: `Bearer ${u2.accessToken}` },
    });
    expect(res.status).toBe(404);
  });

  it('U2: 列表 limit/offset 分页切片，越界空页与非法参数 400', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const mem = createMemorySessionsRepo();
    const app = buildApp({ members: new Set([userId]), sessions: mem });

    const mk = async (title: string) => {
      const res = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      expect(res.status).toBe(201);
      return ((await res.json()) as { data: { sessionId: string } }).data.sessionId;
    };
    const ids = [await mk('S1'), await mk('S2'), await mk('S3')];

    const list = async (query: string) => {
      const res = await app.request(`/api/v1/knowledge-bases/${KB}/sessions?${query}`, {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      return res;
    };

    const page1Res = await list('limit=2&offset=0');
    expect(page1Res.status).toBe(200);
    const page1 = ((await page1Res.json()) as { data: { items: { sessionId: string }[] } }).data
      .items;
    expect(page1).toHaveLength(2);

    const page2Res = await list('limit=2&offset=2');
    expect(page2Res.status).toBe(200);
    const page2 = ((await page2Res.json()) as { data: { items: { sessionId: string }[] } }).data
      .items;
    expect(page2).toHaveLength(1);

    const seen = [...page1, ...page2].map((i) => i.sessionId);
    expect(new Set(seen).size).toBe(3);
    expect([...seen].sort()).toEqual([...ids].sort());

    // 越界：offset 超过总数 → 200 空页（不是 500 / 不是回第一页）
    const beyondRes = await list('limit=2&offset=99');
    expect(beyondRes.status).toBe(200);
    expect(
      ((await beyondRes.json()) as { data: { items: unknown[] } }).data.items,
    ).toEqual([]);

    for (const q of ['limit=0', 'limit=101', 'offset=-1', 'limit=abc']) {
      const bad = await list(q);
      expect(bad.status).toBe(400);
      expect(((await bad.json()) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('U5: 在 B 会话发问时近窗与历史窗不得含 A 会话的文本', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const mem = createMemorySessionsRepo();
    const A_QUESTION = 'A会话里的餐补机密原文XYZ';
    const A_ANSWER = 'A机密答案XYZ';
    const B_QUESTION = 'React 有几个大版本？';
    const ASK_QUESTION = 'React 有几个大版本？';

    const windows: string[][] = [];
    const rewritePrompts: string[] = [];
    const chat: GraphChat = async (purpose, messages) => {
      if (purpose === 'rewrite') {
        rewritePrompts.push(messages.find((m) => m.role === 'user')?.content ?? '');
      }
      return rewriteHappyChat(purpose, messages);
    };

    const { executeAsk } = await import('../../src/services/ask/execute.js');
    const { clipSessionWindow, isExplicitSessionBackref } = await import(
      '../../src/services/ask/session-window.js'
    );

    const graphDeps: GraphDeps = {
      rewriteEnabled: true,
      chat,
      retrieve: async () => ({
        ok: true,
        evidence: evidenceOk,
        meta: { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 },
      }),
      loadSessionWindow: async (input) => {
        const messages = await mem.listMessages({
          sessionId: input.sessionId,
          kbId: input.kbId,
          userId: input.userId,
        });
        const window = clipSessionWindow(messages, {
          deepened: isExplicitSessionBackref(ASK_QUESTION),
        });
        windows.push(window.map((w) => w.content));
        return window;
      },
    };

    const app = buildApp({
      members: new Set([userId]),
      sessions: mem,
      askExecute: (params) =>
        executeAsk(params, { skipTrace: true, sessions: mem, graphDeps }),
    });

    const mk = async (title: string) => {
      const res = await app.request(`/api/v1/knowledge-bases/${KB}/sessions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });
      return ((await res.json()) as { data: { sessionId: string } }).data.sessionId;
    };
    const sidA = await mk('A');
    const sidB = await mk('B');

    mem.appendTrace({
      sessionId: sidA,
      kbId: KB,
      userId,
      requestId: 'r-a',
      question: A_QUESTION,
      answer: A_ANSWER,
      status: 'answered',
      reason: 'verified',
    });
    mem.appendTrace({
      sessionId: sidB,
      kbId: KB,
      userId,
      requestId: 'r-b',
      question: B_QUESTION,
      answer: 'React 有若干大版本。',
      status: 'answered',
      reason: 'verified',
    });

    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: ASK_QUESTION,
        sessionId: sidB,
        options: { debug: true },
      }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: {
        status: string;
        sessionId: string | null;
        debug?: { rewriteUsed?: boolean };
      };
    };
    expect(body.data.sessionId).toBe(sidB);
    expect(body.data.status).toBe('answered');
    expect(body.data.debug?.rewriteUsed).toBe(true);

    // 近窗（store 级 window(B)）：只含 B 的轮次
    expect(windows).toHaveLength(1);
    const windowText = windows.flat().join('|');
    expect(windowText).toContain('React');
    expect(windowText).not.toContain(A_QUESTION);
    expect(windowText).not.toContain(A_ANSWER);

    // 进 rewrite 的近窗文本同样不得含 A 原文
    expect(rewritePrompts).toHaveLength(1);
    expect(rewritePrompts[0]).toContain('React');
    expect(rewritePrompts[0]).not.toContain(A_QUESTION);
    expect(rewritePrompts[0]).not.toContain(A_ANSWER);

    // 响应与落库 transcript 都按 session 隔离
    expect(JSON.stringify(body.data)).not.toContain(A_ANSWER);
    expect(mem.dumpTraces(sidB).every((t) => t.question.includes('React'))).toBe(true);
    expect(mem.dumpTraces(sidA).every((t) => t.question.includes('XYZ'))).toBe(true);
  });
});
