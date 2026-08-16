import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../auth/middleware.js';
import { issueTokenPair } from '../auth/identity/token-service.js';
import { requestIdMiddleware } from '../middleware/request-id.js';
import type { ExecuteAskResult } from '../services/ask/index.js';
import { createMemoryKbSettingsRepo } from '../services/kb-settings.js';
import { createAskRoutes } from './ask.js';

const KB = '01900000-0000-7000-8000-0000000000aa';

async function token(userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: 'web',
    roles: ['web_consumer'],
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: '01900000-0000-7000-8000-000000000001',
  });
  return { userId, accessToken: pair.accessToken };
}

function answered(mode: string): ExecuteAskResult {
  return {
    httpStatus: 200,
    response: {
      requestId: 'req',
      status: 'answered',
      answer: 'ok',
      citations: [],
      reason: 'verified',
      suggestedActions: [],
      mode: mode as 'balanced',
      sessionId: null,
    },
    graph: {
      requestId: 'req',
      status: 'answered',
      answer: 'ok',
      citations: [],
      reason: 'verified',
      suggestedActions: [],
      mode: mode as 'balanced',
      rewriteUsed: false,
      sessionDeepened: false,
      evidence_snapshot: [],
    },
  };
}

describe('B2-W ask mode / docTypes 入口闸', () => {
  it('mode 不在 allowedModes → 400', async () => {
    const { userId, accessToken } = await token();
    const settingsRepo = createMemoryKbSettingsRepo([
      {
        id: KB,
        name: 'KB',
        description: null,
        configJson: { allowedModes: ['strict', 'balanced'], defaultMode: 'balanced' },
      },
    ]);
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route(
      '/api/v1',
      createAskRoutes({
        resolveKbMember: async (uid, kid) => kid === KB && uid === userId,
        getKb: async () => ({ id: KB, tenantId: '01900000-0000-7000-8000-000000000001' }),
        settingsRepo,
        execute: async () => answered('balanced'),
      }),
    );
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'q?', options: { mode: 'fast' } }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('mode not allowed');
  });

  it('缺省 mode 用 defaultMode 并传入 execute', async () => {
    const { userId, accessToken } = await token();
    const settingsRepo = createMemoryKbSettingsRepo([
      {
        id: KB,
        name: 'KB',
        description: null,
        configJson: { allowedModes: ['strict', 'balanced'], defaultMode: 'strict' },
      },
    ]);
    let seenMode: string | undefined;
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route(
      '/api/v1',
      createAskRoutes({
        resolveKbMember: async (uid, kid) => kid === KB && uid === userId,
        getKb: async () => ({ id: KB, tenantId: '01900000-0000-7000-8000-000000000001' }),
        settingsRepo,
        execute: async (p) => {
          seenMode = p.body.options?.mode;
          return answered(seenMode ?? 'strict');
        },
      }),
    );
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ question: 'q?' }),
    });
    expect(res.status).toBe(200);
    expect(seenMode).toBe('strict');
  });

  it('scope.docTypes 不在 KB 允许列表 → 400', async () => {
    const { userId, accessToken } = await token();
    const settingsRepo = createMemoryKbSettingsRepo([
      {
        id: KB,
        name: 'KB',
        description: null,
        configJson: {
          allowedModes: ['balanced'],
          defaultMode: 'balanced',
          docTypes: ['hr'],
        },
      },
    ]);
    const app = new Hono<{ Variables: AuthVariables }>();
    app.use('*', requestIdMiddleware);
    app.use('*', attachAuthMiddleware);
    app.route(
      '/api/v1',
      createAskRoutes({
        resolveKbMember: async (uid, kid) => kid === KB && uid === userId,
        getKb: async () => ({ id: KB, tenantId: '01900000-0000-7000-8000-000000000001' }),
        settingsRepo,
        execute: async () => answered('balanced'),
      }),
    );
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        question: 'q?',
        scope: { docTypes: ['legal'] },
      }),
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toContain('docTypes');
  });
});
