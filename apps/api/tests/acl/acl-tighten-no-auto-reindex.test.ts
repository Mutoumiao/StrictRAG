/**
 * 目标：ACL 收紧只外显 reindexRequired + 审计日志，不得自动入队 reindex（人工触发口径的可核对证据）。
 * 需求：功能表 §5.5 · ADR-009 决策 4（「收紧须 reindex 后确认」是确认义务而非自动触发）· 覆盖 B2-2
 * 被测：PUT /api/v1/documents/:docId/acl（services/queue.js 的 enqueueIngest 调用面）
 * 简介：收紧与放宽两态、含反复收紧，enqueueIngest 均零调用；reindexRequired 收紧 true / 放宽 false；只写 aclPrincipals 一列。
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
const TENANT = '01900000-0000-7000-8000-000000000001';
const USER_IN = '01900000-0000-7000-8000-0000000000e1';
const USER_OUT = '01900000-0000-7000-8000-0000000000e2';
const DOC_NULL = '01900000-0000-7000-8000-0000000000d1';
const DOC_OUT = '01900000-0000-7000-8000-0000000000d4';

function freshRows() {
  return [
    { ...row(DOC_NULL, null) },
    { ...row(DOC_OUT, [USER_OUT]) },
  ];
}

function row(id: string, aclPrincipals: string[] | null) {
  return {
    id,
    title: id,
    status: 'ready',
    approvalStatus: 'approved',
    lifecycle: 'active',
    tenantId: TENANT,
    kbId: KB,
    indexVersion: 1,
    activeIndexVersion: 1,
    aclPrincipals,
  };
}

const state = {
  rows: freshRows(),
  patches: [] as Array<Record<string, unknown>>,
  enqueue: [] as unknown[],
};

vi.mock('../../src/services/documents.js', () => ({
  documentRepo: {
    getDoc: async (id: string) => state.rows.find((r) => r.id === id) ?? null,
    getKb: async () => ({ id: KB, tenantId: TENANT, configJson: {} }),
    patchMeta: async (id: string, patch: Record<string, unknown>) => {
      state.patches.push(patch);
      const found = state.rows.find((r) => r.id === id);
      if (found && patch.aclPrincipals !== undefined) {
        found.aclPrincipals = patch.aclPrincipals as string[] | null;
      }
    },
  },
}));

vi.mock('../../src/services/queue.js', () => ({
  enqueueIngest: async (data: unknown) => {
    state.enqueue.push(data);
    return 'job-should-not-happen';
  },
}));

const { createDocumentRoutes } = await import('../../src/routes/documents/index.js');

// 成员闸桩：本文件主题是「收紧是否自动入队」，成员资格统一放行
const resolveKbMember = async () => true;

function buildApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route('/api/v1', createDocumentRoutes({ resolveKbMember }));
  return app;
}

async function editorToken() {
  const pair = await issueTokenPair({
    userId: USER_IN,
    app: 'admin',
    roles: ['kb_admin'],
    tenantId: TENANT,
  });
  return pair.accessToken;
}

async function put(
  app: Hono<{ Variables: AuthVariables }>,
  docId: string,
  aclPrincipals: string[] | null,
) {
  const res = await app.request(`/api/v1/documents/${docId}/acl`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${await editorToken()}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ aclPrincipals }),
  });
  const body = (await res.json()) as { data: { reindexRequired: boolean } };
  return { status: res.status, reindexRequired: body.data.reindexRequired };
}

beforeEach(() => {
  state.rows = freshRows();
  state.patches = [];
  state.enqueue = [];
});

describe('ACL 收紧不入队 reindex（人工触发口径）', () => {
  it('收紧（null → 名单）：外显 reindexRequired=true，但 enqueueIngest 零调用', async () => {
    const app = buildApp();

    const res = await put(app, DOC_NULL, [USER_IN]);

    expect(res.status).toBe(200);
    expect(res.reindexRequired).toBe(true);
    // 人工口径：PUT 只外显信号，不替运营做入队决策
    expect(state.enqueue).toHaveLength(0);
    // 只写 aclPrincipals 一列，不碰版本位 / 就绪位
    expect(state.patches).toEqual([{ aclPrincipals: [USER_IN] }]);
  });

  it('放宽（名单扩容）：reindexRequired=false，同样零入队', async () => {
    const app = buildApp();

    const res = await put(app, DOC_OUT, [USER_OUT, USER_IN]);

    expect(res.status).toBe(200);
    expect(res.reindexRequired).toBe(false);
    expect(state.enqueue).toHaveLength(0);
    expect(state.patches).toEqual([{ aclPrincipals: [USER_OUT, USER_IN] }]);
  });

  it('反复收紧同一文档：无自动入队，故不存在重复入队的幂等问题', async () => {
    const app = buildApp();

    for (const next of [[USER_IN], [USER_IN, USER_OUT], [USER_OUT]]) {
      const res = await put(app, DOC_NULL, next);
      expect(res.status).toBe(200);
    }

    expect(state.enqueue).toHaveLength(0);
    expect(state.patches).toHaveLength(3);
    // 文档行的版本位始终未被 api 侧改写（reindex 后才由 worker 抬）
    expect(state.rows.find((r) => r.id === DOC_NULL)?.indexVersion).toBe(1);
    expect(state.rows.find((r) => r.id === DOC_NULL)?.activeIndexVersion).toBe(1);
  });
});
