/**
 * 目标：ask 检索期必须比对「入口租户」与「KB 行租户」，不一致即拒答且不进 dense/ES。
 * 需求：ADR-009（prds/11-decisions/00-adr-index.md:151）与 prds/04-pipelines/02-online-ask-langgraph.md:170
 *       「0b 检索层纵深：断言 userId ∈ kb_members(kbId) 且 tenant 一致；失败 → finalize abstained
 *       reason=not_member（或 internal_guard），不进 dense/ES」。
 * 被测：runAskGraph 的检索节点前置断言 · POST /knowledge-bases/:kbId/ask · POST /internal/eval/execute-ask
 * 简介：等值照常检索（回归锚）；不等值 → status=abstained ∧ reason=not_member ∧ 注入的 retrieve **零调用**；
 *       用户入口：与 KB 同租户的令牌得 answered，异租户令牌得 not_member（钉子令牌租户不得被 KB 租户顶替）；
 *       内口：KB 行不存在 → 404，body 租户与 KB 行不等 → 拒，相等 → 照常。
 *       反证：删掉 run.ts 的判定 → 不等值两条转 answered 而红；把入口的 kbTenantId 顶替成 tenantId → 同两条红。
 */

import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createAskRoutes } from '../../src/routes/ask.js';
import { createEvalRoutes } from '../../src/routes/eval.js';
import { executeAsk } from '../../src/services/ask/index.js';
import {
  baseInput,
  deps,
  evidenceOk,
  happyChat,
  runAskGraph,
} from './_support/graph-harness.js';

const KB = '01900000-0000-7000-8000-0000000000aa';
/** KB 行的租户 */
const KB_TENANT = '01900000-0000-7000-8000-000000000001';
/** 令牌声明的另一个租户 */
const OTHER_TENANT = '01900000-0000-7000-8000-0000000000b1';

const META = { esMode: 'mock', candidateCount: 1, denseHits: 1, sparseHits: 1 };

async function token(tenantId: string) {
  const userId = uuidv7();
  const pair = await issueTokenPair({
    userId,
    app: 'web',
    roles: ['web_consumer'],
    email: `${userId.slice(0, 8)}@test.local`,
    tenantId,
  });
  return { userId, accessToken: pair.accessToken };
}

function buildAskApp(kbTenant: string) {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createAskRoutes({
      resolveKbMember: async (_userId, kbId) => kbId === KB,
      getKb: async (id) => (id === KB ? { id: KB, tenantId: kbTenant } : null),
      settingsRepo: { get: async () => null, update: async () => null },
      // 只补基建：图与判定走真实现（不等值在检索前就拦，不需要 Gateway）
      executeDeps: { skipTrace: true, graphDeps: deps({ chat: happyChat }) },
    }),
  );
  return app;
}

function buildEvalApp() {
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.route(
    '/api/v1',
    createEvalRoutes({
      getKb: async (id) => (id === KB ? { id: KB, tenantId: KB_TENANT } : null),
      internalToken: () => 'secret-eval',
      execute: (params) =>
        executeAsk(params, { skipTrace: true, graphDeps: deps({ chat: happyChat }) }),
    }),
  );
  return app;
}

describe('runAskGraph · 租户一致性（0b 检索层纵深）', () => {
  it('入口租户与 KB 租户相等 → 照常检索（回归锚）', async () => {
    let retrieveCalls = 0;
    const r = await runAskGraph(
      baseInput(),
      deps({
        chat: happyChat,
        retrieve: async () => {
          retrieveCalls += 1;
          return { ok: true, evidence: evidenceOk, meta: META };
        },
      }),
    );
    expect(r.status).toBe('answered');
    expect(retrieveCalls).toBe(1);
  });

  it('入口租户 ≠ KB 租户 → abstained/not_member 且 retrieve 零调用', async () => {
    let retrieveCalls = 0;
    const r = await runAskGraph(
      baseInput({ kbTenantId: OTHER_TENANT }),
      deps({
        chat: happyChat,
        retrieve: async () => {
          retrieveCalls += 1;
          return { ok: true, evidence: evidenceOk, meta: META };
        },
      }),
    );
    expect(r.status).toBe('abstained');
    expect(r.reason).toBe('not_member');
    expect(retrieveCalls).toBe(0);
  });
});

describe('POST /knowledge-bases/:kbId/ask · 入口租户与 KB 行租户', () => {
  it('令牌租户 = KB 行租户 → answered', async () => {
    const { accessToken } = await token(KB_TENANT);
    const res = await buildAskApp(KB_TENANT).request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ question: '年假有多少天？', options: { mode: 'balanced' } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; reason?: string } };
    expect(body.data.status).toBe('answered');
  });

  it('令牌租户 ≠ KB 行租户 → abstained/not_member（禁止用 KB 租户顶替令牌租户）', async () => {
    const { accessToken } = await token(OTHER_TENANT);
    const res = await buildAskApp(KB_TENANT).request(`/api/v1/knowledge-bases/${KB}/ask`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ question: '年假有多少天？', options: { mode: 'balanced' } }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; reason?: string } };
    expect(body.data.status).toBe('abstained');
    expect(body.data.reason).toBe('not_member');
  });
});

describe('POST /internal/eval/execute-ask · 内口租户口径', () => {
  async function post(app: Hono, body: Record<string, unknown>) {
    return app.request('/api/v1/internal/eval/execute-ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-eval-internal-token': 'secret-eval' },
      body: JSON.stringify(body),
    });
  }

  it('kbId 不存在 → 404（此前不校验 KB 是否存在）', async () => {
    const res = await post(buildEvalApp(), {
      kbId: '01900000-0000-7000-8000-0000000000ff',
      tenantId: KB_TENANT,
      userId: uuidv7(),
      question: '年假有多少天？',
    });
    expect(res.status).toBe(404);
  });

  it('body 租户 = KB 行租户 → 照常执行', async () => {
    const res = await post(buildEvalApp(), {
      kbId: KB,
      tenantId: KB_TENANT,
      userId: uuidv7(),
      question: '年假有多少天？',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; reason?: string } };
    expect(body.data.status).toBe('answered');
  });

  it('body 租户 ≠ KB 行租户 → abstained/not_member', async () => {
    const res = await post(buildEvalApp(), {
      kbId: KB,
      tenantId: OTHER_TENANT,
      userId: uuidv7(),
      question: '年假有多少天？',
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { status: string; reason?: string } };
    expect(body.data.status).toBe('abstained');
    expect(body.data.reason).toBe('not_member');
  });
});
