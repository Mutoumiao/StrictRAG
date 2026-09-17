/**
 * 目标：带 Idempotency-Key 的重试不得重跑问答图，必须复用同一 requestId 的终态；在途与不可回读要可辨。
 * 需求：prds/05-api §2.7 契约铁律 6 · prds/04-pipelines §8 幂等 · prds/03-data §2.1（`ask:idem:{key}` TTL 10m）
 * 被测：POST /knowledge-bases/:kbId/ask 的 Idempotency-Key 分支（同步与流式）
 * 简介：不带键行为不变；同键重放不跑图且与终态回读口同形；在途 409 带 details.requestId；跨用户不命中；非成员仍 403 且不占键；重试不吃配额；超长键 400；空白键视为未带；流式重放写 data-ask-final；终态不可同形 409；跑图抛错释放键。
 */

import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import type { RateLimitResult } from '../../src/obs/index.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import {
  askIdemKey,
  claimAskIdem,
  createMemoryAskIdemStore,
  type AskIdemStore,
} from '../../src/services/ask/idempotency.js';
import type { AskFinalSource, ExecuteAskResult } from '../../src/services/ask/index.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';

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

type ExecFn = (params: unknown) => Promise<ExecuteAskResult>;

/** 与在线终态同形的假执行结果；requestId 决定正文，便于证明「重放没重跑」 */
function fakeAnswered(requestId: string): ExecuteAskResult {
  return {
    httpStatus: 200,
    response: {
      requestId,
      status: 'answered',
      answer: `答案-${requestId}`,
      answerKind: 'knowledge',
      citations: [
        { chunkId: CHUNK, docId: DOC, title: '休假', preview: '15天', lifecycle: 'active' },
      ],
      minSupport: 0.9,
      reason: 'verified',
      userMessage: `答案-${requestId}`,
      suggestedActions: [],
      latencyMs: 12,
      mode: 'balanced',
      sessionId: null,
    },
    graph: {
      requestId,
      status: 'answered',
      answer: `答案-${requestId}`,
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
  } as unknown as ExecuteAskResult;
}

function buildApp(opts: {
  members?: Set<string>;
  finals: Map<string, AskFinalSource>;
  execute?: ExecFn;
  idemStore: AskIdemStore;
  checkRateLimit?: (userId: string, kbId: string) => RateLimitResult;
}) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) =>
        kbId === KB && (opts.members ?? new Set()).has(userId),
      getKb: async (id) => (id === KB ? { id, tenantId: TENANT } : null),
      settingsRepo: {
        get: async () => null,
        update: async () => null,
      },
      getFinal: async (requestId) => opts.finals.get(requestId) ?? null,
      idemStore: opts.idemStore,
      ...(opts.execute ? { execute: opts.execute } : {}),
      ...(opts.checkRateLimit ? { checkRateLimit: opts.checkRateLimit } : {}),
    }),
  );
  return app;
}

type Envelope = {
  ok: boolean;
  data?: { requestId: string; answer?: string; status?: string; reason?: string };
  error?: { code: string; message: string; details?: { requestId?: string; status?: string } };
};

/** 单个用例的完整夹具：终态表 + 幂等 store + 计次执行 */
function makeHarness(opts: {
  members?: Set<string>;
  checkRateLimit?: (userId: string, kbId: string) => RateLimitResult;
}) {
  const finals = new Map<string, AskFinalSource>();
  const store = createMemoryAskIdemStore();
  const calls: string[] = [];
  const execute: ExecFn = async (params) => {
    const p = params as { requestId: string };
    calls.push(p.requestId);
    const result = fakeAnswered(p.requestId);
    // 与真执行同序：图跑完即落 trace（幂等命中读的就是它）
    finals.set(p.requestId, {
      requestId: p.requestId,
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      minSupport: 0.9,
      latencyMs: 12,
      mode: 'balanced',
      sessionId: null,
      answer: result.response.answer,
      citations: result.response.citations,
    });
    return result;
  };
  const app = buildApp({
    members: opts.members,
    finals,
    execute,
    idemStore: store,
    ...(opts.checkRateLimit ? { checkRateLimit: opts.checkRateLimit } : {}),
  });
  return { app, finals, store, calls, execute };
}

async function askRaw(
  app: Hono<{ Variables: AuthVariables }>,
  accessToken: string,
  idemKey?: string,
  accept?: string,
) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`,
    'content-type': 'application/json',
  };
  if (idemKey !== undefined) headers['idempotency-key'] = idemKey;
  if (accept) headers.accept = accept;
  return app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ question: '年假几天？' }),
  });
}

/** 非流式便捷封装（同步 JSON） */
async function ask(
  app: Hono<{ Variables: AuthVariables }>,
  accessToken: string,
  idemKey?: string,
) {
  const res = await askRaw(app, accessToken, idemKey);
  return { res, body: (await res.json()) as Envelope };
}

/** 终态回读口（对照用）：命中必须与该口同形 */
async function readFinal(
  app: Hono<{ Variables: AuthVariables }>,
  accessToken: string,
  requestId: string,
) {
  const res = await app.request(`/api/v1/ask/${requestId}/final`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  return (await res.json()) as { data: { ready: boolean; response?: unknown } };
}

describe('POST ask · Idempotency-Key（PRD §2.7 铁律 6）', () => {
  it('不带 Idempotency-Key：每轮各自跑图，行为与今天一致', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });

    const first = await ask(h.app, accessToken);
    const second = await ask(h.app, accessToken);

    expect(first.res.status).toBe(200);
    expect(second.res.status).toBe(200);
    expect(h.calls).toHaveLength(2);
    expect(first.body.data?.requestId).not.toBe(second.body.data?.requestId);
  });

  it('同键重放：不跑第二条图，复用首次 requestId，且与终态回读口同形', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });

    const first = await ask(h.app, accessToken, 'retry-1');
    const replay = await ask(h.app, accessToken, 'retry-1');

    expect(h.calls).toHaveLength(1);
    expect(replay.res.status).toBe(200);
    expect(replay.body.data?.requestId).toBe(first.body.data?.requestId);
    expect(replay.body.data?.answer).toBe(first.body.data?.answer);

    // 「最终 DTO」= 终态回读口的那一份（工单 92 已钉在线 ≡ 回读，这里钉命中 ≡ 回读）
    const final = await readFinal(h.app, accessToken, first.body.data!.requestId);
    expect(final.data.ready).toBe(true);
    expect(replay.body.data).toEqual(final.data.response);
  });

  it('在途命中：409 CONFLICT + details.requestId，且不跑图', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });
    const key = askIdemKey({ tenantId: TENANT, userId, kbId: KB, rawKey: 'inflight-1' });
    await claimAskIdem(h.store, key, 'req-inflight-old');

    const { res, body } = await ask(h.app, accessToken, 'inflight-1');

    expect(res.status).toBe(409);
    expect(body.error?.code).toBe('CONFLICT');
    expect(body.error?.details?.requestId).toBe('req-inflight-old');
    expect(body.error?.details?.status).toBe('in_flight');
    expect(h.calls).toHaveLength(0);
  });

  it('trace 在但终态不可同形：409 not_replayable，不编造 answered', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });
    const key = askIdemKey({ tenantId: TENANT, userId, kbId: KB, rawKey: 'old-doc-1' });
    await claimAskIdem(h.store, key, 'req-old-1');
    h.finals.set('req-old-1', {
      requestId: 'req-old-1',
      kbId: KB,
      status: 'answered',
      reason: 'verified',
      minSupport: 0.9,
      latencyMs: 12,
      mode: 'balanced',
      sessionId: null,
      answer: '员工年假为15天。',
      citations: null,
    });

    const { res, body } = await ask(h.app, accessToken, 'old-doc-1');

    expect(res.status).toBe(409);
    expect(body.error?.details?.status).toBe('not_replayable');
    expect(JSON.stringify(body)).not.toContain('员工年假为15天');
    expect(h.calls).toHaveLength(0);
  });

  it('跨用户同键不命中：键含 userId，他人结果不可被复用', async () => {
    const a = await token(['web_consumer']);
    const b = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([a.userId, b.userId]) });

    const first = await ask(h.app, a.accessToken, 'shared-raw-key');
    const second = await ask(h.app, b.accessToken, 'shared-raw-key');

    expect(h.calls).toHaveLength(2);
    expect(second.body.data?.requestId).not.toBe(first.body.data?.requestId);
    expect(second.body.data?.answer).not.toBe(first.body.data?.answer);
  });

  it('非成员带键仍 403，且不占键（成员闸在前）', async () => {
    const { accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set() });

    const { res } = await ask(h.app, accessToken, 'outsider-1');

    expect(res.status).toBe(403);
    expect(h.calls).toHaveLength(0);
  });

  it('重试不消耗配额：幂等短路在限流之前', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const checkRateLimit = vi.fn((): RateLimitResult => ({ ok: true, remaining: 9 }));
    const h = makeHarness({ members: new Set([userId]), checkRateLimit });

    await ask(h.app, accessToken, 'quota-1');
    await ask(h.app, accessToken, 'quota-1');

    expect(checkRateLimit).toHaveBeenCalledTimes(1);
    expect(h.calls).toHaveLength(1);
  });

  it('超长键 400 VALIDATION_ERROR（不得静默降级成无幂等）', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });

    const { res, body } = await ask(h.app, accessToken, 'k'.repeat(201));

    expect(res.status).toBe(400);
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(h.calls).toHaveLength(0);
  });

  it('空白键视为未带：仍各自跑图', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });

    await ask(h.app, accessToken, '   ');
    await ask(h.app, accessToken, '   ');

    expect(h.calls).toHaveLength(2);
  });

  it('流式重放：写 data-ask-final 且复用首次 requestId', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });

    const firstRes = await askRaw(h.app, accessToken, 'stream-1', 'text/event-stream');
    expect(await firstRes.text()).toContain('data-ask-final');
    const replayRes = await askRaw(h.app, accessToken, 'stream-1', 'text/event-stream');
    const replayText = await replayRes.text();

    expect(h.calls).toHaveLength(1);
    expect(replayText).toContain('data-ask-final');
    expect(replayText).toContain(h.calls[0]!);
  });

  it('跑图抛错：释放键，同键重试可再跑（不留假「在途」）', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const h = makeHarness({ members: new Set([userId]) });
    let boom = true;
    const app = buildApp({
      members: new Set([userId]),
      finals: h.finals,
      idemStore: h.store,
      execute: async (params) => {
        const p = params as { requestId: string };
        h.calls.push(p.requestId);
        if (boom) {
          boom = false;
          throw new Error('graph exploded');
        }
        return fakeAnswered(p.requestId);
      },
    });

    await ask(app, accessToken, 'boom-1').catch(() => null);
    const retry = await ask(app, accessToken, 'boom-1');

    expect(h.calls).toHaveLength(2);
    expect(retry.res.status).toBe(200);
    expect(retry.body.data?.requestId).toBe(h.calls[1]);
  });
});
