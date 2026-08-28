/**
 * 目标：GET /ask/:requestId 必须按 KB 成员权限回读当时 evidence_snapshot 与 graph_trace。
 * 需求：prds/05-api §2.9 · 功能表 §5.2 引用回溯 · 剧本 F3
 * 被测：GET /ask/:requestId
 * 简介：成员 200 得快照；非成员 403；缺失 404；preview 截断；不依赖现网分片（reindex 后仍在）。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import {
  EVIDENCE_SNAPSHOT_PREVIEW_MAX,
  type AskTraceAuditSource,
} from '../../src/services/ask/index.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const OTHER_KB = '01900000-0000-7000-8000-0000000000bb';
const TENANT = '01900000-0000-7000-8000-000000000001';
const CHUNK = '11111111-1111-7111-8111-111111111111';
const DOC = '22222222-2222-7222-8222-222222222222';
const REQ = 'req-audit-1';

async function token(roles: string[], userId = uuidv7()) {
  const pair = await issueTokenPair({
    userId,
    app: roles.includes('web_consumer') && !roles.includes('kb_admin') ? 'web' : 'admin',
    roles,
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId: TENANT,
  });
  return { userId, accessToken: pair.accessToken };
}

function sampleTrace(overrides: Partial<AskTraceAuditSource> = {}): AskTraceAuditSource {
  return {
    requestId: REQ,
    kbId: KB,
    status: 'answered',
    reason: 'verified',
    mode: 'balanced',
    latencyMs: 42,
    sessionId: null,
    evidenceSnapshot: [
      {
        chunkId: CHUNK,
        docId: DOC,
        lifecycle: 'active',
        preview: '员工年假为15天',
        title: '休假',
      },
    ],
    graphTrace: { routeLabel: 'single', llmCalls: 2 },
    ...overrides,
  };
}

function buildApp(opts: {
  members?: Set<string>;
  traces?: Map<string, AskTraceAuditSource>;
}) {
  const members = opts.members ?? new Set<string>();
  const traces = opts.traces ?? new Map([[REQ, sampleTrace()]]);
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) =>
        id === KB || id === OTHER_KB ? { id, tenantId: TENANT } : null,
      settingsRepo: {
        get: async () => null,
        update: async () => null,
      },
      getTrace: async (requestId) => traces.get(requestId) ?? null,
    }),
  );
  return app;
}

describe('GET /ask/:requestId 审计回溯', () => {
  it('成员可得当时 evidence_snapshot 与 graph_trace', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      data: {
        requestId: string;
        kbId: string;
        evidenceSnapshot: Array<{ chunkId: string; preview?: string; title?: string }>;
        graphTrace: { routeLabel?: string } | null;
        answer?: string;
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data.requestId).toBe(REQ);
    expect(body.data.kbId).toBe(KB);
    expect(body.data.evidenceSnapshot[0]?.chunkId).toBe(CHUNK);
    expect(body.data.evidenceSnapshot[0]?.preview).toBe('员工年假为15天');
    expect(body.data.graphTrace?.routeLabel).toBe('single');
    expect(body.data.answer).toBeUndefined();
  });

  it('reindex 后仍回读落库快照，不查现网分片', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const stale = sampleTrace({
      evidenceSnapshot: [
        {
          chunkId: CHUNK,
          docId: DOC,
          lifecycle: 'active',
          preview: '当时切片：年假15天',
          title: '休假（已 reindex 前）',
        },
      ],
    });
    const app = buildApp({
      members: new Set([userId]),
      traces: new Map([[REQ, stale]]),
    });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      data: { evidenceSnapshot: Array<{ preview?: string; title?: string }> };
    };
    expect(body.data.evidenceSnapshot[0]?.preview).toContain('当时切片');
    expect(body.data.evidenceSnapshot[0]?.title).toContain('reindex 前');
  });

  it('graphTrace 只保留白名单键，不得夹带 answer', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({
      members: new Set([userId]),
      traces: new Map([
        [
          REQ,
          sampleTrace({
            graphTrace: {
              routeLabel: 'single',
              llmCalls: 2,
              answer: '不应出现的正文',
            },
          }),
        ],
      ]),
    });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (await res.json()) as {
      data: { graphTrace: Record<string, unknown> | null };
    };
    expect(body.data.graphTrace).toEqual({ routeLabel: 'single', llmCalls: 2 });
    expect(JSON.stringify(body.data.graphTrace)).not.toContain('不应出现');
  });

  it('preview 超过上限必须截断，不得带回全文', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const long = '全文'.repeat(200);
    const app = buildApp({
      members: new Set([userId]),
      traces: new Map([
        [
          REQ,
          sampleTrace({
            evidenceSnapshot: [
              {
                chunkId: CHUNK,
                docId: DOC,
                preview: long,
              },
            ],
          }),
        ],
      ]),
    });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    const body = (await res.json()) as {
      data: { evidenceSnapshot: Array<{ preview?: string; text?: string; body?: string }> };
    };
    expect(body.data.evidenceSnapshot[0]?.preview?.length).toBe(EVIDENCE_SNAPSHOT_PREVIEW_MAX);
    expect(body.data.evidenceSnapshot[0]?.text).toBeUndefined();
    expect(body.data.evidenceSnapshot[0]?.body).toBeUndefined();
  });

  it('非该 KB 成员 403', async () => {
    const { accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('trace 不存在 404', async () => {
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]), traces: new Map() });
    const res = await app.request(`/api/v1/ask/missing-req`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('无 Bearer 401', async () => {
    const app = buildApp({});
    const res = await app.request(`/api/v1/ask/${REQ}`);
    expect(res.status).toBe(401);
  });

  it('超管可旁路成员闸回读', async () => {
    const { accessToken } = await token(['super_admin']);
    const app = buildApp({ members: new Set() });
    const res = await app.request(`/api/v1/ask/${REQ}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { requestId: string } };
    expect(body.data.requestId).toBe(REQ);
  });
});
