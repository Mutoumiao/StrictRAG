/**
 * 目标：流式断线后必须能按 requestId 取回该轮终态，且与在线终态同形；读不回时如实说读不回。
 * 需求：功能表 §3 流式回答「断线可按 requestId 重拉终态」· prds/05-api §2.7 契约铁律 5
 * 被测：GET /ask/:requestId/final · POST ask 的 data-status(running) 与 X-Request-Id 透传
 * 简介：成员得同形终态；通过轮 citations 未落库 → ready=false 且不冒充 answered；拒答旧轮仍可回读；非成员 403；缺失 404；审计口不因此改语义；running part 带本轮 requestId。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import type {
  AskFinalSource,
  AskTraceAuditSource,
  ExecuteAskResult,
} from '../../src/services/ask/index.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';
const REQ = 'req-final-1';

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

/** 通过轮：终态完整（含落库 citations） */
function answeredFinal(overrides: Partial<AskFinalSource> = {}): AskFinalSource {
  return {
    requestId: REQ,
    kbId: KB,
    status: 'answered',
    reason: 'verified',
    minSupport: 0.9,
    latencyMs: 12,
    mode: 'balanced',
    sessionId: null,
    answer: '员工年假为15天。',
    citations: [
      {
        chunkId: CHUNK,
        docId: DOC,
        title: '休假',
        preview: '15天',
        lifecycle: 'active',
      },
    ],
    ...overrides,
  };
}

function auditTrace(overrides: Partial<AskTraceAuditSource> = {}): AskTraceAuditSource {
  return {
    requestId: REQ,
    kbId: KB,
    status: 'answered',
    reason: 'verified',
    mode: 'balanced',
    latencyMs: 12,
    sessionId: null,
    evidenceSnapshot: [{ chunkId: CHUNK, docId: DOC, preview: '15天', lifecycle: 'active' }],
    graphTrace: { routeLabel: 'single' },
    ...overrides,
  };
}

function buildApp(opts: {
  members?: Set<string>;
  finals?: Map<string, AskFinalSource>;
  traces?: Map<string, AskTraceAuditSource>;
  execute?: () => Promise<ExecuteAskResult>;
}) {
  const members = opts.members ?? new Set<string>();
  const finals = opts.finals ?? new Map([[REQ, answeredFinal()]]);
  const traces = opts.traces ?? new Map([[REQ, auditTrace()]]);
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) => (id === KB ? { id, tenantId: TENANT } : null),
      settingsRepo: {
        get: async () => null,
        update: async () => null,
      },
      getTrace: async (requestId) => traces.get(requestId) ?? null,
      getFinal: async (requestId) => finals.get(requestId) ?? null,
      ...(opts.execute ? { execute: opts.execute } : {}),
    }),
  );
  return app;
}

describe('GET /ask/:requestId/final 断线重拉终态', () => {
  it('成员可得与在线终态同形的 AskResponse', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/ask/${REQ}/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        requestId: string;
        ready: boolean;
        response: {
          status: string;
          answer: string;
          answerKind?: string;
          citations: { chunkId: string }[];
          reason: string;
          userMessage?: string;
          suggestedActions: unknown[];
          minSupport?: number;
          mode?: string;
          latencyMs?: number;
          sessionId?: string | null;
        };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.ready).toBe(true);
    expect(body.data.requestId).toBe(REQ);
    expect(body.data.response.status).toBe('answered');
    expect(body.data.response.answer).toBe('员工年假为15天。');
    expect(body.data.response.answerKind).toBe('knowledge');
    expect(body.data.response.citations[0]?.chunkId).toBe(CHUNK);
    expect(body.data.response.reason).toBe('verified');
    expect(body.data.response.minSupport).toBe(0.9);
    expect(body.data.response.mode).toBe('balanced');
    expect(body.data.response.latencyMs).toBe(12);
    // 通过轮在线 userMessage 即 answer；建议动作由 reason 确定性重建
    expect(body.data.response.userMessage).toBe('员工年假为15天。');
    expect(body.data.response.suggestedActions).toEqual([
      { type: 'view_citations', label: '查看引用' },
    ]);
  });

  it('通过轮 citations 未落库 → ready=false，且不得出现 answered 正文', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      finals: new Map([[REQ, answeredFinal({ citations: null })]]),
    });
    const res = await app.request(`/api/v1/ask/${REQ}/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { ready: boolean; message?: string; response?: unknown };
    };
    expect(body.data.ready).toBe(false);
    expect(body.data.response).toBeUndefined();
    expect(body.data.message).toBeTruthy();
    expect(JSON.stringify(body.data)).not.toContain('员工年假为15天');
  });

  it('拒答旧轮（citations 未落列）仍可回读：零引用可由 status 推出', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      finals: new Map([
        [
          REQ,
          answeredFinal({
            status: 'abstained',
            reason: 'unsupported_claims',
            minSupport: 0.18,
            answer: '',
            citations: null,
          }),
        ],
      ]),
    });
    const res = await app.request(`/api/v1/ask/${REQ}/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (await res.json()) as {
      data: {
        ready: boolean;
        response: {
          status: string;
          answer: string;
          citations: unknown[];
          userMessage?: string;
          answerKind?: string;
          minSupport?: number;
        };
      };
    };
    expect(body.data.ready).toBe(true);
    expect(body.data.response.status).toBe('abstained');
    expect(body.data.response.answer).toBe('');
    expect(body.data.response.citations).toEqual([]);
    expect(body.data.response.answerKind).toBeUndefined();
    expect(body.data.response.minSupport).toBe(0.18);
    expect(body.data.response.userMessage).toBe('生成内容未能通过证据校验，已拒绝作答。');
  });

  it('审计口语义不变：/final 不夹带 evidenceSnapshot；审计仍不带 answer', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const headers = { authorization: `Bearer ${accessToken}` };

    const finalRes = await app.request(`/api/v1/ask/${REQ}/final`, { headers });
    const finalBody = (await finalRes.json()) as { data: Record<string, unknown> };
    expect(finalBody.data.evidenceSnapshot).toBeUndefined();
    expect(finalBody.data.graphTrace).toBeUndefined();

    const auditRes = await app.request(`/api/v1/ask/${REQ}`, { headers });
    const auditBody = (await auditRes.json()) as {
      data: { answer?: string; evidenceSnapshot: unknown[] };
    };
    expect(auditBody.data.answer).toBeUndefined();
    expect(auditBody.data.evidenceSnapshot).toHaveLength(1);
  });

  it('非该 KB 成员 403', async () => {
    const { accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('该 requestId 无 trace → 404（与 ready=false 可辨），无 Bearer → 401', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]), finals: new Map() });
    const res = await app.request(`/api/v1/ask/missing-req/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');

    const noAuth = await buildApp({}).request(`/api/v1/ask/${REQ}/final`);
    expect(noAuth.status).toBe(401);
  });

  it('超管可旁路成员闸回读', async () => {
    const { accessToken } = await token(['super_admin']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}/final`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { ready: boolean } };
    expect(body.data.ready).toBe(true);
  });

  it('流式 running part 带本轮 requestId；客户端下发的 X-Request-Id 被透传', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const CLIENT_REQ = 'client-minted-1';
    const app = buildApp({
      members: new Set([userId]),
      execute: async () => ({
        httpStatus: 200,
        response: {
          requestId: CLIENT_REQ,
          status: 'answered',
          answer: '年假为15天。',
          answerKind: 'knowledge',
          citations: [{ chunkId: CHUNK, docId: DOC }],
          reason: 'verified',
          suggestedActions: [],
          sessionId: null,
        },
        graph: {
          requestId: CLIENT_REQ,
          status: 'answered',
          answer: '年假为15天。',
          answerKind: 'knowledge',
          citations: [],
          reason: 'verified',
          suggestedActions: [],
          mode: 'balanced',
          rewriteUsed: false,
          sessionDeepened: false,
          evidence_snapshot: [],
        },
      }),
    });

    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
        accept: 'text/event-stream',
        'x-request-id': CLIENT_REQ,
      },
      body: JSON.stringify({ question: '年假', options: { stream: true } }),
    });
    expect(res.status).toBe(200);

    const chunks = (await res.text())
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

    const running = chunks.find(
      (o) =>
        o.type === 'data-status' &&
        typeof o.data === 'object' &&
        o.data !== null &&
        (o.data as { phase?: string }).phase === 'running',
    );
    expect(running).toBeTruthy();
    // 客户端自铸的 id 被服务端采纳为**本轮** requestId，断线后即可据此重拉
    expect((running!.data as { requestId?: string }).requestId).toBe(CLIENT_REQ);
  });
});
