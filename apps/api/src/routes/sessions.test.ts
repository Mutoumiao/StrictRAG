import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import {
  createMemorySessionsRepo,
  type SessionsRepo,
} from '../services/sessions.js';
import { createSessionRoutes } from './sessions.js';

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
});
