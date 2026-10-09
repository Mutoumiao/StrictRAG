/**
 * 目标：设置读面的签字包在「包内 τ 与运行时 TAU_CLAIM 不一致 / 包未记录 τ」时必须拒绝加载；
 *       一致时逐位照旧；无包（试点前）保持 null 且不得标成「拒绝」。
 * 需求：prds/08-quality/02-evaluation-and-gates.md §6.0 加载行 · ADR-046 决策 #4 · ADR-062
 *       验收剧本 T6（prds/10-delivery/03-acceptance-scenarios.md）「配置绑定 / 篡改快照 → 加载拒绝」
 * 被测：kb-settings routes 的默认 qualitySnapshot（**不注入**，走真 `defaultQuality`）
 * 简介：只 mock 签字包取数仓储；四态 —— 一致 / 不一致 / τ 未记录 / 无包。
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { uuidv7 } from 'uuidv7';

import { attachAuthMiddleware, type AuthVariables } from '../../src/auth/middleware.js';
import { issueTokenPair } from '../../src/auth/identity/token-service.js';
import { requestIdMiddleware } from '../../src/middleware/request-id.js';
import { createMemoryKbSettingsAuditRepo } from '../../src/services/kb-settings-audit.js';
import { createMemoryKbSettingsRepo } from '../../src/services/kb-settings.js';
import { createKbSettingsRoutes } from '../../src/routes/kb-settings.js';

/** `vi.mock` 工厂会被提升到文件顶部，故用 `vi.hoisted` 先建出这个桩 */
const { latestSignoffPackage } = vi.hoisted(() => ({ latestSignoffPackage: vi.fn() }));

vi.mock('../../src/services/eval-runs.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/eval-runs.js')>();
  return {
    ...actual,
    evalRunRepo: { ...actual.evalRunRepo, latestSignoffPackage },
  };
});

const { env } = await import('../../src/env.js');

const KB = '01900000-0000-7000-8000-0000000000a1';
const TENANT = '01900000-0000-7000-8000-000000000001';
/** 与运行时不同的 τ（避开 0.5 这个默认值，且落在 [0,1] 内） */
const OTHER_TAU = env.TAU_CLAIM === 0.6 ? 0.7 : 0.6;

async function buildApp() {
  const pair = await issueTokenPair({
    userId: uuidv7(),
    app: 'admin',
    roles: ['kb_admin'],
    email: 'gate@test.local',
    tenantId: TENANT,
  });
  const app = new Hono<{ Variables: AuthVariables }>();
  app.use('*', requestIdMiddleware);
  app.use('*', attachAuthMiddleware);
  app.route(
    '/api/v1',
    createKbSettingsRoutes({
      repo: createMemoryKbSettingsRepo([
        {
          id: KB,
          name: 'Gate KB',
          description: null,
          configJson: { allowedModes: ['strict', 'balanced', 'fast'], defaultMode: 'balanced' },
        },
      ]),
      auditRepo: createMemoryKbSettingsAuditRepo(),
      // 刻意**不注入** qualitySnapshot → 走真 `defaultQuality`
      resolveKbMember: async (_userId, kbId) => kbId === KB,
      hasQualifyingL2Archive: async () => false,
    }),
  );
  return { app, accessToken: pair.accessToken };
}

async function getQuality() {
  const { app, accessToken } = await buildApp();
  const res = await app.request(`/api/v1/knowledge-bases/${KB}/settings`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    data: {
      qualitySnapshot: {
        tauClaim: number;
        gatePackageId?: string | null;
        effectiveAt?: string | null;
        gatePackageRejectedReason?: string | null;
      };
    };
  };
  return body.data.qualitySnapshot;
}

beforeEach(() => {
  latestSignoffPackage.mockReset();
});

describe('设置读面 · 签字包加载闸', () => {
  it('一致 → 照旧呈现包 id 与 effectiveAt，且不带拒绝原因', async () => {
    const pkgId = uuidv7();
    latestSignoffPackage.mockResolvedValue({
      id: pkgId,
      effectiveAt: '2026-10-01 10:00:00',
      tauClaim: env.TAU_CLAIM,
    });

    const q = await getQuality();
    expect(q.tauClaim).toBe(env.TAU_CLAIM);
    expect(q.gatePackageId).toBe(pkgId);
    expect(q.effectiveAt).toBe('2026-10-01 10:00:00');
    expect(q.gatePackageRejectedReason ?? null).toBeNull();
  });

  it('包内 τ ≠ 运行时 τ → 拒绝加载：id / effectiveAt 为 null，reason = tau_mismatch', async () => {
    latestSignoffPackage.mockResolvedValue({
      id: uuidv7(),
      effectiveAt: '2026-10-01 10:00:00',
      tauClaim: OTHER_TAU,
    });

    const q = await getQuality();
    expect(q.tauClaim).toBe(env.TAU_CLAIM);
    expect(q.gatePackageId).toBeNull();
    expect(q.effectiveAt).toBeNull();
    expect(q.gatePackageRejectedReason).toBe('tau_mismatch');
  });

  it('包内未记录 τ → 同样拒绝加载，reason = tau_unrecorded（不把无法核对的包当已绑定）', async () => {
    latestSignoffPackage.mockResolvedValue({
      id: uuidv7(),
      effectiveAt: '2026-10-01 10:00:00',
      tauClaim: null,
    });

    const q = await getQuality();
    expect(q.gatePackageId).toBeNull();
    expect(q.effectiveAt).toBeNull();
    expect(q.gatePackageRejectedReason).toBe('tau_unrecorded');
  });

  it('无合格 run（试点前）→ 保持 null 且**不**标拒绝（这不是拒绝加载）', async () => {
    latestSignoffPackage.mockResolvedValue(null);

    const q = await getQuality();
    expect(q.tauClaim).toBe(env.TAU_CLAIM);
    expect(q.gatePackageId).toBeNull();
    expect(q.effectiveAt).toBeNull();
    expect(q.gatePackageRejectedReason ?? null).toBeNull();
  });
});
