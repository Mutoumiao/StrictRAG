/**
 * 目标：库级 GET ingest-report 须成员可读、空列表 200、缺库 404。
 * 需求：prds/05-api GET /knowledge-bases/:kbId/ingest-report · 功能表 §5.2
 * 被测：GET /api/v1/knowledge-bases/:kbId/ingest-report
 * 简介：只回已落库行；doc.view 在 AUTH_ENFORCE 开时验码；不是 doc 级路径。
 */

import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createIngestReportRoutes } from '../../src/routes/ingest-report.js';
import type { IngestReportItem } from '@strict-rag/contracts';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';

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

function buildApp(opts: { members?: Set<string>; rows?: IngestReportItem[]; kbExists?: boolean }) {
  const members = opts.members ?? new Set<string>();
  const rows = opts.rows ?? [];
  const kbExists = opts.kbExists ?? true;
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createIngestReportRoutes({
      resolveKbMember: async (userId, kbId) => kbId === KB && members.has(userId),
      getKb: async (id) => (id === KB && kbExists ? { id } : null),
      reportRepo: {
        listByKb: async (kbId) => rows.filter((r) => r.kbId === kbId),
      },
    }),
  );
  return app;
}

const ROW: IngestReportItem = {
  id: '01900000-0000-7000-8000-0000000000a1',
  kbId: KB,
  docId: '01900000-0000-7000-8000-0000000000d1',
  indexVersion: 1,
  chunkCount: 2,
  internalDropped: 0,
  crossDocDropped: 1,
  contextSource: 'l0',
  conflictPairs: [
    {
      otherDocId: '01900000-0000-7000-8000-0000000000d2',
      otherChunkId: '01900000-0000-7000-8000-0000000000c2',
      action: 'skip_index',
    },
  ],
  dualReady: true,
  embedReady: true,
  esReady: true,
  reconcile: { ok: true, missingCount: 0, orphanCount: 0 },
  createdAt: '2026-08-30 12:00:00',
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /knowledge-bases/:kbId/ingest-report', () => {
  it('成员空列表 200', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp({ members: new Set([userId]) });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ingest-report`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; data: IngestReportItem[] };
    expect(body.ok).toBe(true);
    expect(body.data).toEqual([]);
  });

  it('成员回已落库行，含跨 doc 冲突对、不含 Hit@k', async () => {
    const { userId, accessToken } = await token(['kb_admin']);
    const app = buildApp({ members: new Set([userId]), rows: [ROW] });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ingest-report`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: IngestReportItem[] };
    expect(body.data).toEqual([ROW]);
    expect(body.data[0]?.crossDocDropped).toBe(1);
    expect(body.data[0]?.conflictPairs).toHaveLength(1);
    expect(JSON.stringify(body.data[0])).not.toMatch(/hitAtK|pendingReview/);
  });

  it('非成员 403；无令牌 401；超管对缺库 404', async () => {
    const { userId } = await token(['kb_admin']);
    const outsider = await token(['kb_admin']);
    const admin = await token(['super_admin']);
    const app = buildApp({ members: new Set([userId]), kbExists: true });

    const forbidden = await app.request(`/api/v1/knowledge-bases/${KB}/ingest-report`, {
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(forbidden.status).toBe(403);

    const unauth = await app.request(`/api/v1/knowledge-bases/${KB}/ingest-report`);
    expect(unauth.status).toBe(401);

    const missingApp = buildApp({ members: new Set([userId]), kbExists: false });
    const missing = await missingApp.request(
      '/api/v1/knowledge-bases/01900000-0000-7000-8000-0000000000ff/ingest-report',
      { headers: { authorization: `Bearer ${admin.accessToken}` } },
    );
    expect(missing.status).toBe(404);
  });

  it('AUTH_ENFORCE 开时无 doc.view 的成员 403', async () => {
    vi.stubEnv('AUTH_ENFORCE', 'true');
    const { userId, accessToken } = await token(['web_consumer']);
    const app = buildApp({ members: new Set([userId]), rows: [ROW] });
    const res = await app.request(`/api/v1/knowledge-bases/${KB}/ingest-report`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(403);
  });
});
