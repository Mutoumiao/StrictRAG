import {
  BizCode,
  PatchKbSettingsBodySchema,
  PutKbConsumeBindingsBodySchema,
  type KbSettings,
  type KbSettingsAuditItem,
  type PlatformBindings,
  type QualitySnapshot,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import {
  requirePermission,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { env } from '../env.js';
import { fail, ok } from '../lib/response.js';
import { childLogger } from '../logger.js';
import { evalRunRepo } from '../services/eval-runs.js';
import {
  SETTINGS_AUDIT_LIST_LIMIT,
  kbSettingsAuditRepo,
  type KbSettingsAuditRepo,
} from '../services/kb-settings-audit.js';
import {
  buildKbSettingsView,
  kbSettingsRepo,
  mergeKbSettingsPatch,
  type KbSettingsRepo,
} from '../services/kb-settings.js';
import {
  bindingsToMap,
  modelGatewayRepo,
  resolveTenantId,
  validatePlatformBindings,
  type ModelGatewayRepo,
} from '../services/model-gateway.js';

export type KbSettingsRouteDeps = {
  repo?: KbSettingsRepo;
  auditRepo?: KbSettingsAuditRepo;
  gatewayRepo?: ModelGatewayRepo;
  /** 质量 snapshot 注入；默认 env.TAU_CLAIM */
  qualitySnapshot?: (kbId: string) => QualitySnapshot | Promise<QualitySnapshot>;
  resolveKbMember?: ResolveKbMember;
  hasQualifyingL2Archive?: (kbId: string) => Promise<boolean>;
};

function wantsRewriteDefaultOn(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  const row = raw as Record<string, unknown>;
  if (row.sessionRewriteEnabledDefault === true) return true;
  const sr = row.sessionRewrite;
  if (sr && typeof sr === 'object' && (sr as { enabledDefault?: unknown }).enabledDefault === true) {
    return true;
  }
  return false;
}

/**
 * 签字包只读回填：`qualitySnapshot` 从 `eval_runs` **读时派生**（ADR-046 四要素之四「KB 配置快照绑定
 * `eval_runs`」+ ADR-061 双轨）。**无合格 run → 保持 null**（不臆造 id、不回落 env、不代签）。
 * `tauClaim` 仍取 `TAU_CLAIM`（ADR-007 唯一源；改由签字包加载须先 ADR）。
 */
async function defaultQuality(kbId: string): Promise<QualitySnapshot> {
  const pkg = await evalRunRepo.latestSignoffPackage(kbId);
  return {
    tauClaim: env.TAU_CLAIM,
    gatePackageId: pkg?.id ?? null,
    effectiveAt: pkg?.effectiveAt ?? null,
  };
}

/**
 * 知识库设置（ADR-054 / B2）。
 * 始终 requirePermission('kb.config.write')——与 members/chunks 同纪律。
 */
export function createKbSettingsRoutes(
  deps: KbSettingsRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const repo = deps.repo ?? kbSettingsRepo;
  const auditRepo = deps.auditRepo ?? kbSettingsAuditRepo;
  const gateway = deps.gatewayRepo ?? modelGatewayRepo;
  const qualityOf = deps.qualitySnapshot ?? defaultQuality;
  const hasArchive =
    deps.hasQualifyingL2Archive ?? ((id: string) => evalRunRepo.hasQualifyingL2Archive(id));
  const routes = new Hono<{ Variables: AuthVariables }>();
  const write = requirePermission('kb.config.write', {
    resolveKbMember: deps.resolveKbMember,
  });

  /** GET /api/v1/knowledge-bases/:kbId/settings */
  routes.get('/knowledge-bases/:kbId/settings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const data: KbSettings = buildKbSettingsView({ row, quality: await qualityOf(kbId) });
    return ok(c, data);
  });

  /** PATCH /api/v1/knowledge-bases/:kbId/settings */
  routes.patch('/knowledge-bases/:kbId/settings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const raw = await c.req.json().catch(() => ({}));
    if (wantsRewriteDefaultOn(raw)) {
      const archived = await hasArchive(kbId);
      if (!archived) {
        return fail(
          c,
          BizCode.SESSION_REWRITE_DISABLED,
          'session rewrite default stays off until a qualifying L2 archive exists',
          400,
        );
      }
      return fail(c, BizCode.VALIDATION_ERROR, 'session rewrite switch stays locked', 400);
    }
    const parsed = PatchKbSettingsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const merged = mergeKbSettingsPatch(row, parsed.data);
    if (!merged.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, merged.message, 400);
    }

    const updated = await repo.update(kbId, {
      name: merged.name,
      description: merged.description,
      configJson: merged.configJson,
    });
    if (!updated) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const auth = c.get('auth');
    if (Object.keys(merged.diff).length > 0) {
      childLogger({
        requestId: c.get('requestId'),
        userId: auth?.userId,
        kbId,
      }).info(
        {
          event: 'kb_settings_patch',
          diff: merged.diff,
        },
        'kb settings updated',
      );
      await auditRepo.insert({
        tenantId: resolveTenantId(auth?.tenantId),
        kbId,
        actorUserId: auth?.userId ?? '',
        diff: merged.diff,
      });
    }

    const data: KbSettings = buildKbSettingsView({ row: updated, quality: await qualityOf(kbId) });
    return ok(c, data);
  });

  /** GET /api/v1/knowledge-bases/:kbId/settings-audit — 该库已落行；空列表 200 */
  routes.get('/knowledge-bases/:kbId/settings-audit', write, async (c) => {
    const kbId = c.req.param('kbId');
    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const listed = await auditRepo.listByKb(kbId);
    const data: KbSettingsAuditItem[] = listed.slice(0, SETTINGS_AUDIT_LIST_LIMIT);
    return ok(c, data);
  });

  routes.get('/knowledge-bases/:kbId/model-bindings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const tenantId = resolveTenantId(c.get('auth')?.tenantId);
    const rows = await gateway.listKbBindings(tenantId, kbId);
    const data: { bindings: PlatformBindings } = { bindings: bindingsToMap(rows) };
    return ok(c, data);
  });

  routes.put('/knowledge-bases/:kbId/model-bindings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PutKbConsumeBindingsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const providers = await gateway.listProviders(tenantId);
    const check = validatePlatformBindings(providers, parsed.data.bindings);
    if (!check.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, check.message, 400);
    }
    const bindRows = Object.entries(parsed.data.bindings).map(([purpose, b]) => ({
      purpose,
      primaryRef: b.primary,
      fallbackRefs: b.fallbacks ?? [],
    }));
    const saved = await gateway.replaceKbBindings(tenantId, kbId, bindRows, auth?.userId);
    return ok(c, { bindings: bindingsToMap(saved) });
  });

  return routes;
}

export const kbSettingsRoutes = createKbSettingsRoutes();
