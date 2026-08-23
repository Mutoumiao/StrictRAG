/**
 * 目标：超限必须返回 429 RATE_LIMITED。
 * 需求：ARCH-P2-4
 * 被测：checkFixedWindowRateLimit / POST ask 429
 * 简介：超限返回 429 RATE_LIMITED；ask 路由走同一闸。
 */

import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { checkFixedWindowRateLimit } from '../../src/obs/index.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';
import { installObsReset } from './_support/reset.js';

const KB = '01900000-0000-7000-8000-0000000000aa';

installObsReset();

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
            sessionDeepened: false,
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
