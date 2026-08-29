import { timingSafeEqual } from 'node:crypto';

import {
  BizCode,
  CreateEvalRunBodySchema,
  CreateGoldQuestionBodySchema,
  EvalRunListResponseSchema,
  EvalRunsQuerySchema,
  GoldQuestionListResponseSchema,
  GoldQuestionsQuerySchema,
  PatchGoldQuestionBodySchema,
  type CreateEvalRunResponse,
  type EvalJobData,
  type GoldQuestion,
} from '@strict-rag/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import { uuidv7 } from 'uuidv7';

import {
  requirePermission,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { env } from '../env.js';
import { fail, ok } from '../lib/response.js';
import { documentRepo } from '../services/documents.js';
import {
  evalRunRepo,
  resolveRetrieveMode,
  toEvalRunDto,
  type EvalRunRepo,
} from '../services/eval-runs.js';
import { executeAsk } from '../services/ask/index.js';
import {
  goldQuestionRepo,
  type GoldQuestionRow,
  type GoldRepo,
} from '../services/gold-questions.js';
import { enqueueEval } from '../services/queue.js';

const UuidParam = z.string().uuid();

const InternalExecuteBodySchema = z
  .object({
    kbId: z.string().uuid(),
    tenantId: z.string().uuid(),
    userId: z.string().uuid(),
    question: z.string().min(1).max(8000),
  })
  .strict();

export type EvalRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  gold?: GoldRepo;
  evalRuns?: EvalRunRepo;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
  enqueue?: (data: EvalJobData) => Promise<string | undefined>;
  internalToken?: () => string;
  execute?: typeof executeAsk;
  retrieveEsMode?: () => string;
};

function toGoldDto(row: GoldQuestionRow): GoldQuestion {
  return {
    id: row.id,
    kbId: row.kbId,
    caseKey: row.caseKey,
    question: row.question,
    type: row.type,
    expectedDocIds: row.expectedDocIds,
    expectedChunkIds: row.expectedChunkIds,
    rubric: row.rubric,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function tokenMatches(provided: string | undefined, expected: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * 评测底线：
 * - gold-questions CRUD · eval.run
 * - POST/GET eval/runs · 只入队
 * - POST /internal/eval/execute-ask · worker 口令，skipTrace
 */
export function createEvalRoutes(deps: EvalRouteDeps = {}) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const gold = deps.gold ?? goldQuestionRepo;
  const runs = deps.evalRuns ?? evalRunRepo;
  const getKb = deps.getKb ?? ((id: string) => documentRepo.getKb(id));
  const enqueue = deps.enqueue ?? enqueueEval;
  const tokenOf = deps.internalToken ?? (() => env.EVAL_INTERNAL_TOKEN);
  const runAsk = deps.execute ?? executeAsk;
  const esModeOf = deps.retrieveEsMode ?? (() => env.RETRIEVE_ES_MODE);
  const evalMw = requirePermission('eval.run', { resolveKbMember: deps.resolveKbMember });

  routes.get('/knowledge-bases/:kbId/gold-questions', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const q = GoldQuestionsQuerySchema.safeParse({
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    });
    if (!q.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, q.error.flatten());
    }
    const limit = q.data.limit ?? 50;
    const offset = q.data.offset ?? 0;
    const items = await gold.listByKb({ kbId, limit, offset });
    const data = GoldQuestionListResponseSchema.parse({ items: items.map(toGoldDto) });
    return ok(c, data);
  });

  routes.post('/knowledge-bases/:kbId/gold-questions', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const raw = await c.req.json().catch(() => null);
    const parsed = CreateGoldQuestionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid gold question body', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const created = await gold.create({
      tenantId: kb.tenantId,
      kbId,
      createdBy: auth?.userId,
      data: parsed.data,
    });
    if (!created.ok) {
      return fail(c, BizCode.CONFLICT, 'gold question caseKey already exists', 409, {
        caseKey: parsed.data.caseKey,
      });
    }
    return ok(c, toGoldDto(created.row), 201);
  });

  routes.patch('/knowledge-bases/:kbId/gold-questions/:id', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const id = c.req.param('id');
    if (!UuidParam.safeParse(id).success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid gold question id', 400);
    }
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const raw = await c.req.json().catch(() => null);
    const parsed = PatchGoldQuestionBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid gold question patch', 400, parsed.error.flatten());
    }
    const auth = c.get('auth');
    const updated = await gold.update({
      id,
      kbId,
      updatedBy: auth?.userId,
      data: parsed.data,
    });
    if (!updated.ok) {
      if (updated.reason === 'conflict') {
        return fail(c, BizCode.CONFLICT, 'gold question caseKey already exists', 409);
      }
      return fail(c, BizCode.NOT_FOUND, 'gold question not found', 404, { id });
    }
    return ok(c, toGoldDto(updated.row));
  });

  routes.delete('/knowledge-bases/:kbId/gold-questions/:id', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const id = c.req.param('id');
    if (!UuidParam.safeParse(id).success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid gold question id', 400);
    }
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const removed = await gold.remove({ id, kbId });
    if (!removed) return fail(c, BizCode.NOT_FOUND, 'gold question not found', 404, { id });
    return ok(c, { deleted: true });
  });

  routes.get('/knowledge-bases/:kbId/eval/runs', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const q = EvalRunsQuerySchema.safeParse({
      limit: c.req.query('limit'),
      offset: c.req.query('offset'),
    });
    if (!q.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, q.error.flatten());
    }
    const items = await runs.listByKb({
      kbId,
      limit: q.data.limit ?? 20,
      offset: q.data.offset ?? 0,
    });
    const data = EvalRunListResponseSchema.parse({
      items: items.map((row) => toEvalRunDto(row, false)),
    });
    return ok(c, data);
  });

  routes.get('/knowledge-bases/:kbId/eval/runs/:runId', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const runId = c.req.param('runId');
    if (!UuidParam.safeParse(runId).success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid run id', 400);
    }
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const row = await runs.getByKbAndId(kbId, runId);
    if (!row) return fail(c, BizCode.NOT_FOUND, 'eval run not found', 404, { runId });
    return ok(c, toEvalRunDto(row, true));
  });

  routes.post('/knowledge-bases/:kbId/eval/runs', evalMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404, { kbId });
    const raw = await c.req.json().catch(() => ({}));
    const parsed = CreateEvalRunBodySchema.safeParse(raw ?? {});
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid eval run body', 400, parsed.error.flatten());
    }
    const n = await gold.countByKb(kbId);
    if (n === 0) {
      return fail(c, BizCode.VALIDATION_ERROR, 'no gold questions in this knowledge base', 400);
    }
    const auth = c.get('auth');
    if (!auth) return fail(c, BizCode.UNAUTHORIZED, 'authentication required', 401);
    const retrieveMode = resolveRetrieveMode(esModeOf());
    const queued = await runs.createQueued({
      tenantId: kb.tenantId,
      kbId,
      retrieveMode,
      notes: parsed.data.notes,
      createdBy: auth.userId,
    });
    const jobId = await enqueue({
      tenantId: kb.tenantId,
      kbId,
      runId: queued.id,
      userId: auth.userId,
      retrieveMode,
      requestId: c.get('requestId'),
      maxCases: parsed.data.maxCases,
    });
    await runs.setJobId(queued.id, jobId ?? null);
    const data: CreateEvalRunResponse = {
      runId: queued.id,
      jobId: jobId ?? null,
      status: 'queued',
    };
    return ok(c, data);
  });

  routes.post('/internal/eval/execute-ask', async (c) => {
    const expected = tokenOf();
    const provided = c.req.header('x-eval-internal-token');
    if (!expected) {
      return fail(c, BizCode.SERVICE_UNAVAILABLE, 'eval internal execute is disabled', 503);
    }
    if (!tokenMatches(provided, expected)) {
      return fail(c, BizCode.UNAUTHORIZED, 'invalid eval internal token', 401);
    }
    const raw = await c.req.json().catch(() => null);
    const parsed = InternalExecuteBodySchema.safeParse(raw);
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid execute-ask body', 400, parsed.error.flatten());
    }
    const result = await runAsk(
      {
        requestId: uuidv7(),
        kbId: parsed.data.kbId,
        tenantId: parsed.data.tenantId,
        userId: parsed.data.userId,
        membership: 'member',
        body: { question: parsed.data.question, options: { stream: false } },
      },
      { skipTrace: true },
    );
    return ok(c, {
      status: result.graph.status,
      reason: result.graph.reason,
    });
  });

  return routes;
}

export const evalRoutes = createEvalRoutes();
