import {
  CreateSessionBodySchema,
  BizCode,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requireKbMember, type AuthVariables, type ResolveKbMember } from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { documentRepo } from '../services/documents.js';
import { sessionsRepo, type SessionsRepo } from '../services/sessions.js';

export type SessionRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
  sessions?: SessionsRepo;
};

/**
 * POST/GET …/sessions · GET …/sessions/:sessionId
 * 始终 requireKbMember；仅本人线程；历史 ≠ evidence。
 */
export function createSessionRoutes(deps: SessionRouteDeps = {}) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const memberMw = requireKbMember({ resolveKbMember: deps.resolveKbMember });
  const getKb = deps.getKb ?? ((id: string) => documentRepo.getKb(id));
  const repo = deps.sessions ?? sessionsRepo;

  /** POST /knowledge-bases/:kbId/sessions */
  routes.post('/knowledge-bases/:kbId/sessions', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateSessionBodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const row = await repo.create({
      kbId,
      tenantId: auth.tenantId ?? kb.tenantId,
      userId: auth.userId,
      title: parsed.data.title ?? null,
    });

    return ok(c, row, 201);
  });

  /** GET /knowledge-bases/:kbId/sessions */
  routes.get('/knowledge-bases/:kbId/sessions', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const limit = Number(c.req.query('limit') ?? '50');
    const offset = Number(c.req.query('offset') ?? '0');
    const items = await repo.list({
      kbId,
      userId: auth.userId,
      limit: Number.isFinite(limit) ? limit : 50,
      offset: Number.isFinite(offset) ? offset : 0,
    });
    return ok(c, { items });
  });

  /** GET /knowledge-bases/:kbId/sessions/:sessionId */
  routes.get('/knowledge-bases/:kbId/sessions/:sessionId', memberMw, async (c) => {
    const kbId = c.req.param('kbId');
    const sessionId = c.req.param('sessionId');
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const meta = await repo.getOwned({ sessionId, kbId, userId: auth.userId });
    if (!meta) {
      return fail(c, BizCode.NOT_FOUND, 'session not found', 404);
    }

    const messages = await repo.listMessages({
      sessionId,
      kbId,
      userId: auth.userId,
    });

    return ok(c, { ...meta, messages });
  });

  return routes;
}

export const sessionRoutes = createSessionRoutes();
