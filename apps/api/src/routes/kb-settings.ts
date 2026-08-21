import {
  BizCode,
  PatchKbSettingsBodySchema,
  PutPlatformBindingsBodySchema,
  type KbSettings,
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
} from '../services/model-gateway.js';

export type KbSettingsRouteDeps = {
  repo?: KbSettingsRepo;
  /** 质量 snapshot 注入；默认 env.TAU_CLAIM */
  qualitySnapshot?: () => QualitySnapshot;
  resolveKbMember?: ResolveKbMember;
};

function defaultQuality(): QualitySnapshot {
  return {
    tauClaim: env.TAU_CLAIM,
    gatePackageId: null,
    effectiveAt: null,
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
  const qualityOf = deps.qualitySnapshot ?? defaultQuality;
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
    const data: KbSettings = buildKbSettingsView({ row, quality: qualityOf() });
    return ok(c, data);
  });

  /** PATCH /api/v1/knowledge-bases/:kbId/settings */
  routes.patch('/knowledge-bases/:kbId/settings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const raw = await c.req.json().catch(() => ({}));
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
    }

    const data: KbSettings = buildKbSettingsView({ row: updated, quality: qualityOf() });
    return ok(c, data);
  });

  routes.get('/knowledge-bases/:kbId/model-bindings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const tenantId = resolveTenantId(c.get('auth')?.tenantId);
    const rows = await modelGatewayRepo.listKbBindings(tenantId, kbId);
    const data: { bindings: PlatformBindings } = { bindings: bindingsToMap(rows) };
    return ok(c, data);
  });

  routes.put('/knowledge-bases/:kbId/model-bindings', write, async (c) => {
    const kbId = c.req.param('kbId');
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PutPlatformBindingsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const row = await repo.get(kbId);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const providers = await modelGatewayRepo.listProviders(tenantId);
    const check = validatePlatformBindings(providers, parsed.data.bindings);
    if (!check.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, check.message, 400);
    }
    const bindRows = Object.entries(parsed.data.bindings).map(([purpose, b]) => ({
      purpose,
      primaryRef: b.primary,
      fallbackRefs: b.fallbacks ?? [],
    }));
    const saved = await modelGatewayRepo.replaceKbBindings(tenantId, kbId, bindRows, auth?.userId);
    return ok(c, { bindings: bindingsToMap(saved) });
  });

  return routes;
}

export const kbSettingsRoutes = createKbSettingsRoutes();
