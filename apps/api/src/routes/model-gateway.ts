import {
  BizCode,
  CreateModelProviderBodySchema,
  MODEL_PROVIDER_PRESETS,
  PatchModelProviderBodySchema,
  PutPlatformBindingsBodySchema,
  type ModelCatalogItem,
  type ModelProvider,
  type PlatformBindings,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { childLogger } from '../logger.js';
import {
  applyCreateBody,
  applyPatchBody,
  bindingsToMap,
  buildCatalog,
  modelGatewayRepo,
  providerReferencedByBindings,
  resolveTenantId,
  toPublicProvider,
  validatePlatformBindings,
  type ModelGatewayRepo,
} from '../services/model-gateway.js';

export type ModelGatewayRouteDeps = {
  repo?: ModelGatewayRepo;
};

/**
 * 模型供应商 + 平台绑定（ADR-055 / B3）。
 * 始终 requirePermission('model.gateway.manage')。
 */
export function createModelGatewayRoutes(
  deps: ModelGatewayRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const repo = deps.repo ?? modelGatewayRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const manage = requirePermission('model.gateway.manage');

  routes.get('/admin/model-providers/presets', manage, async (c) => {
    return ok(c, MODEL_PROVIDER_PRESETS);
  });

  routes.get('/admin/model-providers', manage, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const rows = await repo.listProviders(tenantId);
    const data: ModelProvider[] = rows.map(toPublicProvider);
    return ok(c, data);
  });

  routes.post('/admin/model-providers', manage, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateModelProviderBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const created = await repo.createProvider(
      tenantId,
      applyCreateBody(tenantId, parsed.data, auth?.userId),
    );
    childLogger({
      requestId: c.get('requestId'),
      userId: auth?.userId,
    }).info(
      {
        event: 'model_provider_create',
        providerId: created.id,
        name: created.name,
        presetKey: created.presetKey,
        modelCount: created.modelsJson?.length ?? 0,
        hasApiKey: Boolean(created.apiKeyEnc),
      },
      'model provider created',
    );
    return ok(c, toPublicProvider(created), 201);
  });

  routes.get('/admin/model-providers/:id', manage, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const row = await repo.getProvider(tenantId, c.req.param('id'));
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'model provider not found', 404);
    }
    return ok(c, toPublicProvider(row));
  });

  routes.patch('/admin/model-providers/:id', manage, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PatchModelProviderBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const id = c.req.param('id');
    const existing = await repo.getProvider(tenantId, id);
    if (!existing) {
      return fail(c, BizCode.NOT_FOUND, 'model provider not found', 404);
    }
    const applied = applyPatchBody(existing, parsed.data);
    if (!applied.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, applied.message, 400);
    }
    const updated = await repo.updateProvider(tenantId, id, {
      ...applied.patch,
      updatedBy: auth?.userId,
    });
    if (!updated) {
      return fail(c, BizCode.NOT_FOUND, 'model provider not found', 404);
    }
    childLogger({
      requestId: c.get('requestId'),
      userId: auth?.userId,
    }).info(
      {
        event: 'model_provider_patch',
        providerId: id,
        fields: Object.keys(parsed.data).filter((k) => k !== 'apiKey'),
        apiKeyUpdated: parsed.data.apiKey !== undefined,
      },
      'model provider patched',
    );
    return ok(c, toPublicProvider(updated));
  });

  routes.delete('/admin/model-providers/:id', manage, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const id = c.req.param('id');
    const existing = await repo.getProvider(tenantId, id);
    if (!existing) {
      return fail(c, BizCode.NOT_FOUND, 'model provider not found', 404);
    }
    const bRows = await repo.listPlatformBindings(tenantId);
    if (providerReferencedByBindings(bRows, id)) {
      return fail(
        c,
        BizCode.VALIDATION_ERROR,
        'provider is referenced by platform bindings; unbind first',
        400,
      );
    }
    const deleted = await repo.deleteProvider(tenantId, id);
    if (!deleted) {
      return fail(c, BizCode.NOT_FOUND, 'model provider not found', 404);
    }
    childLogger({
      requestId: c.get('requestId'),
      userId: auth?.userId,
    }).info({ event: 'model_provider_delete', providerId: id }, 'model provider deleted');
    return ok(c, { id, deleted: true });
  });

  routes.get('/admin/model-bindings', manage, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const rows = await repo.listPlatformBindings(tenantId);
    const data: PlatformBindings = bindingsToMap(rows);
    return ok(c, { bindings: data });
  });

  routes.put('/admin/model-bindings', manage, async (c) => {
    const raw = await c.req.json().catch(() => ({}));
    const parsed = PutPlatformBindingsBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const providers = await repo.listProviders(tenantId);
    const check = validatePlatformBindings(providers, parsed.data.bindings);
    if (!check.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, check.message, 400);
    }
    const rows = Object.entries(parsed.data.bindings).map(([purpose, b]) => ({
      purpose,
      primaryRef: b.primary,
      fallbackRefs: b.fallbacks ?? [],
    }));
    const saved = await repo.replacePlatformBindings(tenantId, rows, auth?.userId);
    childLogger({
      requestId: c.get('requestId'),
      userId: auth?.userId,
    }).info(
      {
        event: 'model_bindings_put',
        purposes: rows.map((r) => r.purpose),
      },
      'platform model bindings saved',
    );
    return ok(c, { bindings: bindingsToMap(saved) });
  });

  routes.get('/model-catalog', manage, async (c) => {
    const auth = c.get('auth');
    const tenantId = resolveTenantId(auth?.tenantId);
    const providers = await repo.listProviders(tenantId);
    const data: ModelCatalogItem[] = buildCatalog(providers);
    return ok(c, data);
  });

  return routes;
}

export const modelGatewayRoutes = createModelGatewayRoutes();
