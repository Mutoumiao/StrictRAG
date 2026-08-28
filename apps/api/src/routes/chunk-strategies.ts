import {
  BizCode,
  ForUploadQuerySchema,
  PatchKbChunkStrategiesBodySchema,
  type ChunkStrategyCatalogResponse,
  type ChunkStrategySchemaResponse,
  type ForUploadResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import {
  requirePermission,
  requirePermissionWhenEnforced,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import {
  applyKbChunkStrategyPatch,
  buildChunkStrategyCatalog,
  getForUpload,
} from '../services/chunk-strategy-catalog.js';
import { documentRepo } from '../services/documents.js';

export type ChunkStrategyRouteDeps = {
  resolveKbMember?: ResolveKbMember;
};

/**
 * 分片策略三层 HTTP。列表/schema/PATCH 须 kb.config.write；for-upload 给上传人选。
 */
export function createChunkStrategyRoutes(
  deps: ChunkStrategyRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const write = requirePermission('kb.config.write', {
    resolveKbMember: deps.resolveKbMember,
  });
  const upload = requirePermissionWhenEnforced('doc.upload', {
    resolveKbMember: deps.resolveKbMember,
  });

  async function requireKb(kbId: string) {
    return documentRepo.getKb(kbId);
  }

  /** GET /knowledge-bases/:kbId/chunk-strategies */
  routes.get('/knowledge-bases/:kbId/chunk-strategies', write, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await requireKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    const data: ChunkStrategyCatalogResponse = {
      items: await buildChunkStrategyCatalog(kbId),
    };
    return ok(c, data);
  });

  /** GET /knowledge-bases/:kbId/chunk-strategies/schema */
  routes.get('/knowledge-bases/:kbId/chunk-strategies/schema', write, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await requireKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    const items = await buildChunkStrategyCatalog(kbId);
    const data: ChunkStrategySchemaResponse = {
      items: items.map((i) => ({ code: i.code, paramSchema: i.paramSchema })),
    };
    return ok(c, data);
  });

  /** GET /knowledge-bases/:kbId/chunk-strategies/for-upload */
  routes.get('/knowledge-bases/:kbId/chunk-strategies/for-upload', upload, async (c) => {
    const kbId = c.req.param('kbId');
    const parsed = ForUploadQuerySchema.safeParse({
      contentType: c.req.query('contentType'),
    });
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, parsed.error.flatten());
    }
    const kb = await requireKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    const data: ForUploadResponse = await getForUpload(kbId, parsed.data.contentType);
    return ok(c, data);
  });

  /** PATCH /knowledge-bases/:kbId/chunk-strategies */
  routes.patch('/knowledge-bases/:kbId/chunk-strategies', write, async (c) => {
    const kbId = c.req.param('kbId');
    const parsed = PatchKbChunkStrategiesBodySchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }
    const kb = await requireKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    const applied = await applyKbChunkStrategyPatch(kbId, parsed.data);
    if (!applied.ok) {
      return fail(c, BizCode.VALIDATION_ERROR, applied.message, 400);
    }
    const data: ChunkStrategyCatalogResponse = { items: applied.items };
    return ok(c, data);
  });

  return routes;
}

export const chunkStrategyRoutes = createChunkStrategyRoutes();
