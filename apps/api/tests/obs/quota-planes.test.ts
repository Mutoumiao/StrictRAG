/**
 * 目标：ask 与 ingest 平面配额必须隔离，触顶不得 200 空答 answered。
 * 需求：剧本 R5 / R8 / R9 · ARCH-P2-4
 * 被测：POST ask / POST complete / checkFixedWindowRateLimit 分 store / plane 指标
 * 简介：分 store 注入；ask 429 带 plane=ask 与 ask_quota_exhausted；ingest 429 带 plane=ingest；打满一侧不阻断另一侧。
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import {
  QUOTA_PLANES,
  askRateLimitKey,
  checkFixedWindowRateLimit,
  ingestRateLimitKey,
  metricGet,
  metricsSnapshot,
  recordAskResult,
  recordIngestComplete,
  recordLlmCall,
  recordRerank,
  type RateLimitStore,
} from '../../src/obs/index.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import type { ExecuteAskResult } from '../../src/services/ask/index.js';
import { installObsReset } from './_support/reset.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const DOC = '01900000-0000-7000-8000-0000000000d1';
const TENANT = '01900000-0000-7000-8000-000000000001';

const completeState = {
  markCalls: [] as Array<{ id: string; size: number }>,
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) =>
      id === DOC
        ? {
            id: DOC,
            kbId: KB,
            tenantId: TENANT,
            objectKey: `kb/${KB}/${DOC}`,
            chunkStrategy: 'structure_paragraph',
            approvalStatus: 'none',
            status: 'uploaded',
            byteSize: null,
            contentType: 'text/plain',
            ownerDeptId: null,
          }
        : null,
    getKb: async (id: string) => (id === KB ? { id: KB, tenantId: TENANT, configJson: {} } : null),
    markCompletePending: async (id: string, size: number) => {
      completeState.markCalls.push({ id, size });
    },
    patchMeta: async () => undefined,
  },
}));

vi.mock('../../src/services/storage.js', () => ({
  getStorage: () => ({
    headObject: async () => ({ byteSize: 12, contentType: 'text/plain' }),
  }),
  effectiveMaxUploadBytes: () => 10_000_000,
}));

const { createDocumentRoutes } = await import('../../src/routes/documents/index.js');

installObsReset();

afterEach(() => {
  completeState.markCalls = [];
});

function emptyStore(): RateLimitStore {
  return new Map();
}

function answeredAsk(): ExecuteAskResult {
  return {
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
  };
}

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

function buildAskApp(opts: {
  store: RateLimitStore;
  limit: number;
  now?: () => number;
  execute?: () => Promise<ExecuteAskResult>;
}) {
  let executeCalls = 0;
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async () => true,
      getKb: async () => ({ id: KB, tenantId: TENANT }),
      checkRateLimit: (userId, kbId) =>
        checkFixedWindowRateLimit(askRateLimitKey(userId, kbId), {
          limit: opts.limit,
          store: opts.store,
          now: opts.now,
        }),
      execute: async () => {
        executeCalls += 1;
        if (opts.execute) return opts.execute();
        return answeredAsk();
      },
    }),
  );
  return { app, getExecuteCalls: () => executeCalls };
}

function buildCompleteApp(opts: { store: RateLimitStore; limit: number; now?: () => number }) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createDocumentRoutes({
      checkIngestRateLimit: (tenantId, kbId) =>
        checkFixedWindowRateLimit(ingestRateLimitKey(tenantId, kbId), {
          limit: opts.limit,
          store: opts.store,
          now: opts.now,
        }),
    }),
  );
  return app;
}

async function postAsk(app: Hono, accessToken: string, question: string) {
  return app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ question, options: { stream: false } }),
  });
}

async function postComplete(app: Hono, accessToken: string) {
  return app.request(`/api/v1/knowledge-bases/${KB}/documents/${DOC}/complete`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  });
}

describe('三平面配额最小闭环', () => {
  it('ask RPM>0 触顶 → 429 RATE_LIMITED + plane=ask + ask_quota_exhausted，不得 200 answered', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const { app, getExecuteCalls } = buildAskApp({ store: emptyStore(), limit: 1 });

    const okRes = await postAsk(app, accessToken, 'q1');
    expect(okRes.status).toBe(200);

    const limited = await postAsk(app, accessToken, 'q2');
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as {
      ok: boolean;
      data?: { status?: string };
      error: {
        code: string;
        details?: { plane?: string; ask_quota_exhausted?: boolean; retryAfterSec?: number };
      };
    };
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.details?.plane).toBe('ask');
    expect(body.error.details?.ask_quota_exhausted).toBe(true);
    expect(body.error.details?.retryAfterSec).toBeGreaterThan(0);
    expect(body.data?.status).not.toBe('answered');
    expect(getExecuteCalls()).toBe(1);
    expect(userId).toBeTruthy();
  });

  it('ingest RPM>0 触顶 complete → 429 RATE_LIMITED + plane=ingest，不 markComplete', async () => {
    const { accessToken } = await token(['kb_admin']);
    const app = buildCompleteApp({ store: emptyStore(), limit: 1 });

    const okRes = await postComplete(app, accessToken);
    expect(okRes.status).toBe(200);
    expect(completeState.markCalls).toHaveLength(1);

    const limited = await postComplete(app, accessToken);
    expect(limited.status).toBe(429);
    const body = (await limited.json()) as {
      error: { code: string; details?: { plane?: string; retryAfterSec?: number } };
    };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.details?.plane).toBe('ingest');
    expect(body.error.details?.retryAfterSec).toBeGreaterThan(0);
    expect(completeState.markCalls).toHaveLength(1);
  });

  it('打满 ask 不阻断 complete（R5）', async () => {
    const now = () => 1_000_000;
    const askStore = emptyStore();
    const ingestStore = emptyStore();
    const { accessToken } = await token(['kb_admin']);
    const { app: askApp } = buildAskApp({ store: askStore, limit: 1, now });
    const completeApp = buildCompleteApp({ store: ingestStore, limit: 1, now });

    expect((await postAsk(askApp, accessToken, 'q1')).status).toBe(200);
    expect((await postAsk(askApp, accessToken, 'q2')).status).toBe(429);

    const completeRes = await postComplete(completeApp, accessToken);
    expect(completeRes.status).toBe(200);
    expect(completeState.markCalls).toHaveLength(1);
  });

  it('打满 ingest 不阻断 ask（R5）', async () => {
    const now = () => 1_000_000;
    const askStore = emptyStore();
    const ingestStore = emptyStore();
    const { accessToken } = await token(['kb_admin']);
    const { app: askApp, getExecuteCalls } = buildAskApp({ store: askStore, limit: 1, now });
    const completeApp = buildCompleteApp({ store: ingestStore, limit: 1, now });

    expect((await postComplete(completeApp, accessToken)).status).toBe(200);
    expect((await postComplete(completeApp, accessToken)).status).toBe(429);
    expect(completeState.markCalls).toHaveLength(1);

    const askRes = await postAsk(askApp, accessToken, 'still-ok');
    expect(askRes.status).toBe(200);
    const askBody = (await askRes.json()) as { data: { status: string } };
    expect(askBody.data.status).toBe('answered');
    expect(getExecuteCalls()).toBe(1);
  });

  it('RPM=0 两平面都不限', async () => {
    const { accessToken } = await token(['kb_admin']);
    const { app: askApp, getExecuteCalls } = buildAskApp({ store: emptyStore(), limit: 0 });
    const completeApp = buildCompleteApp({ store: emptyStore(), limit: 0 });

    expect((await postAsk(askApp, accessToken, 'a')).status).toBe(200);
    expect((await postAsk(askApp, accessToken, 'b')).status).toBe(200);
    expect((await postComplete(completeApp, accessToken)).status).toBe(200);
    expect((await postComplete(completeApp, accessToken)).status).toBe(200);
    expect(getExecuteCalls()).toBe(2);
    expect(completeState.markCalls).toHaveLength(2);
  });

  it('/metrics 快照含 plane=ask 与 plane=ingest；aux 只留常量不打点', async () => {
    expect(QUOTA_PLANES).toEqual(['ask', 'ingest', 'aux']);

    recordAskResult({ status: 'answered', reason: 'verified', ok: true });
    recordLlmCall('generate', true);
    recordRerank(true);
    recordIngestComplete({ result: 'ok' });
    recordIngestComplete({ result: 'rate_limited' });

    const snap = metricsSnapshot();
    const keys = Object.keys(snap);
    expect(keys.some((k) => k.includes('plane=ask'))).toBe(true);
    expect(keys.some((k) => k.includes('plane=ingest'))).toBe(true);
    expect(keys.some((k) => k.includes('plane=aux'))).toBe(false);
    expect(metricGet('ask_total', { status: 'answered', reason: 'verified', plane: 'ask' })).toBe(
      1,
    );
    expect(metricGet('ingest_complete_total', { plane: 'ingest', result: 'ok' })).toBe(1);
    expect(metricGet('ingest_complete_total', { plane: 'ingest', result: 'rate_limited' })).toBe(1);

    const metricsApp = new Hono();
    metricsApp.get('/metrics', (c) => c.json({ service: 'api', metrics: metricsSnapshot() }, 200));
    const res = await metricsApp.request('/metrics');
    const body = (await res.json()) as { metrics: Record<string, number> };
    const metricKeys = Object.keys(body.metrics);
    expect(metricKeys.some((k) => k.includes('plane=ask'))).toBe(true);
    expect(metricKeys.some((k) => k.includes('plane=ingest'))).toBe(true);
  });

  it('ask 与 ingest 键分前缀、分 store，同后缀互不计数', () => {
    const askStore = emptyStore();
    const ingestStore = emptyStore();
    const now = () => 1_000_000;
    const userId = 'u1';
    const askKey = askRateLimitKey(userId, KB);
    const ingestKey = ingestRateLimitKey(TENANT, KB);
    expect(askKey.startsWith('ask:')).toBe(true);
    expect(ingestKey.startsWith('ingest:')).toBe(true);
    expect(askKey).not.toBe(ingestKey);

    const askOpts = { limit: 1, store: askStore, now };
    const ingestOpts = { limit: 1, store: ingestStore, now };
    expect(checkFixedWindowRateLimit(askKey, askOpts).ok).toBe(true);
    expect(checkFixedWindowRateLimit(askKey, askOpts).ok).toBe(false);
    expect(checkFixedWindowRateLimit(ingestKey, ingestOpts).ok).toBe(true);
    expect(checkFixedWindowRateLimit(ingestKey, ingestOpts).ok).toBe(false);
  });
});
