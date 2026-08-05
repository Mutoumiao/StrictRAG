import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import { createMemoryMembersRepo } from '../services/members.js';
import { createMemberRoutes } from './members.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildApp(opts: {
  members?: Set<string>;
  repo?: ReturnType<typeof createMemoryMembersRepo>;
}) {
  const memberSet = opts.members ?? new Set<string>();
  const repo = opts.repo ?? createMemoryMembersRepo();
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createMemberRoutes({
      members: repo,
      getKb: async (id) => (id === KB ? { id: KB, tenantId: TENANT } : null),
      resolveKbMember: async (userId, kbId) => kbId === KB && memberSet.has(userId),
    }),
  );
  return { app, repo };
}

describe('members CRUD success (memory repo)', () => {
  it('invite by email → 201；list 含成员；remove 后 404', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const { app, repo } = buildApp({ members: new Set([userId]) });

    const invite = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email: 'invitee@test.local', role: 'read' }),
    });
    expect(invite.status).toBe(201);
    const invited = (await invite.json()) as { data: { userId: string; role: string } };
    expect(invited.data.role).toBe('read');
    expect(invited.data.userId).toBeTruthy();

    const list = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.status).toBe(200);
    const body = (await list.json()) as { data: { userId: string; email?: string }[] };
    expect(body.data.some((r) => r.userId === invited.data.userId)).toBe(true);
    expect(body.data.some((r) => r.email === 'invitee@test.local')).toBe(true);

    const del = await app.request(
      `/api/v1/knowledge-bases/${KB}/members/${invited.data.userId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );
    expect(del.status).toBe(200);

    const delAgain = await app.request(
      `/api/v1/knowledge-bases/${KB}/members/${invited.data.userId}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${accessToken}` },
      },
    );
    expect(delAgain.status).toBe(404);
    expect(repo.isMember(invited.data.userId, KB)).toBe(false);
  });

  it('重复邀请 → 409 CONFLICT', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const repo = createMemoryMembersRepo();
    const targetId = uuidv7();
    repo.seedUser({ id: targetId, email: 'dup@test.local' });
    const { app } = buildApp({ members: new Set([userId]), repo });

    const first = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: targetId, role: 'write' }),
    });
    expect(first.status).toBe(201);

    const second = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: targetId, role: 'admin' }),
    });
    expect(second.status).toBe(409);
    const err = (await second.json()) as { error: { code: string } };
    expect(err.error.code).toBe('CONFLICT');
  });

  it('无 userId/email → 400；未知 userId → 404', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const { app } = buildApp({ members: new Set([userId]) });

    const bad = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ role: 'read' }),
    });
    expect(bad.status).toBe(400);

    const missing = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: uuidv7(), role: 'read' }),
    });
    expect(missing.status).toBe(404);
  });

  it('doc_operator 无 member.manage → 403', async () => {
    const { userId, accessToken } = await token(['doc_operator']);
    const { app } = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/members`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });
});
