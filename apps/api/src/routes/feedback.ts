import {
  BizCode,
  CreateFeedbackBodySchema,
  FeedbackQueueQuerySchema,
  PatchFeedbackBodySchema,
  type FeedbackItem,
  type FeedbackListResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import {
  checkPermission,
  evaluateKbMember,
  requireAuth,
  requirePermission,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { recordL3TopicComplaint } from '../obs/index.js';
import { getAskTraceByRequestId } from '../services/ask/traces.js';
import { documentRepo } from '../services/documents.js';
import {
  feedbackRepo,
  type FeedbackRepo,
  type FeedbackRow,
} from '../services/feedback.js';

export type TraceLookup = (requestId: string) => Promise<{
  requestId: string;
  kbId: string;
  userId: string;
  tenantId: string;
  sessionId?: string | null;
} | null>;

export type FeedbackRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  feedback?: FeedbackRepo;
  getTrace?: TraceLookup;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
};

function toPublic(row: FeedbackRow): FeedbackItem {
  const rating: FeedbackItem['rating'] =
    row.rating === 'up' || row.rating === 'down' ? row.rating : null;
  return {
    feedbackId: row.feedbackId,
    requestId: row.requestId,
    kbId: row.kbId,
    userId: row.userId,
    rating,
    category: row.category,
    comment: row.comment,
    status: row.status as FeedbackItem['status'],
    handlerId: row.handlerId,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
  };
}

/**
 * 反馈闭环（API-first · S2b-4）：
 * - POST /ask/:requestId/feedback — 登录 + KB 成员
 * - GET  /knowledge-bases/:kbId/feedback-queue — feedback.queue
 * - PATCH /feedback/:feedbackId — feedback.queue（handler 独立验码）
 */
export function createFeedbackRoutes(deps: FeedbackRouteDeps = {}) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const repo = deps.feedback ?? feedbackRepo;
  const getTrace: TraceLookup =
    deps.getTrace ??
    (async (requestId) => {
      const t = await getAskTraceByRequestId(requestId);
      if (!t) return null;
      return {
        requestId: t.requestId,
        kbId: t.kbId,
        userId: t.userId,
        tenantId: t.tenantId,
        sessionId: t.sessionId,
      };
    });
  const getKb = deps.getKb ?? ((id: string) => documentRepo.getKb(id));
  const queueMw = requirePermission('feedback.queue', {
    resolveKbMember: deps.resolveKbMember,
  });
  const memberOpts = { resolveKbMember: deps.resolveKbMember };

  /** POST /ask/:requestId/feedback — 登录 + KB 成员（kb 从 trace；ARCH-P1b-1 evaluateKbMember） */
  routes.post('/ask/:requestId/feedback', requireAuth(), async (c) => {
    const requestId = c.req.param('requestId');
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateFeedbackBodySchema.safeParse({
      ...(typeof raw === 'object' && raw ? raw : {}),
      requestId,
    });
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid feedback body', 400, parsed.error.flatten());
    }

    const trace = await getTrace(requestId);
    if (!trace) {
      return fail(c, BizCode.NOT_FOUND, 'ask trace not found', 404, { requestId });
    }

    const memberR = await evaluateKbMember(c, trace.kbId, memberOpts);
    if (!memberR.ok) {
      return fail(
        c,
        memberR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        memberR.message,
        memberR.status,
        'details' in memberR ? memberR.details : undefined,
      );
    }

    const row = await repo.create({
      tenantId: auth.tenantId ?? trace.tenantId,
      kbId: trace.kbId,
      userId: auth.userId,
      requestId,
      rating: parsed.data.rating,
      category: parsed.data.category,
      comment: parsed.data.comment,
    });

    if (parsed.data.rating === 'down') {
      try {
        recordL3TopicComplaint({ hasSession: Boolean(trace.sessionId) });
      } catch {
        // ponytail: 打点失败不挡 201
      }
    }

    return ok(c, toPublic(row), 201);
  });

  /** GET /knowledge-bases/:kbId/feedback-queue */
  routes.get('/knowledge-bases/:kbId/feedback-queue', queueMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const q = FeedbackQueueQuerySchema.safeParse({
      status: c.req.query('status'),
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    });
    if (!q.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, q.error.flatten());
    }
    const items = await repo.listByKb({
      kbId,
      status: q.data.status,
      limit: q.data.limit ?? 50,
      offset: q.data.offset ?? 0,
    });
    const data: FeedbackListResponse = { items: items.map(toPublic) };
    return ok(c, data);
  });

  /** PATCH /feedback/:feedbackId — 登录 + feedback.queue + 成员（kb 从 row；ARCH-P1b-1 checkPermission） */
  routes.patch('/feedback/:feedbackId', requireAuth(), async (c) => {
    const feedbackId = c.req.param('feedbackId');
    const auth = c.get('auth');
    if (!auth) {
      return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    }

    const raw = await c.req.json().catch(() => ({}));
    const parsed = PatchFeedbackBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid patch body', 400, parsed.error.flatten());
    }

    const existing = await repo.getById(feedbackId);
    if (!existing) {
      return fail(c, BizCode.NOT_FOUND, 'feedback not found', 404);
    }

    const permR = await checkPermission(c, 'feedback.queue', {
      ...memberOpts,
      kbId: existing.kbId,
    });
    if (!permR.ok) {
      return fail(
        c,
        permR.status === 401 ? BizCode.UNAUTHORIZED : BizCode.FORBIDDEN,
        permR.message,
        permR.status,
        'details' in permR ? permR.details : undefined,
      );
    }

    const updated = await repo.patchStatus({
      feedbackId,
      status: parsed.data.status,
      handlerId: auth.userId,
    });
    if (!updated) {
      return fail(c, BizCode.NOT_FOUND, 'feedback not found', 404);
    }
    return ok(c, toPublic(updated));
  });

  return routes;
}

export const feedbackRoutes = createFeedbackRoutes();
