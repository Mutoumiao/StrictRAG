import { BizCode, InviteMemberBodySchema } from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { documentRepo } from '../services/documents.js';
import { membersRepo } from '../services/members.js';

/**
 * KB 成员 CRUD（设计 §9）。
 * 始终 requirePermission('member.manage') + kb 成员（超管旁路）。
 * 与 AUTH_ENFORCE / demo-ingest 解耦：本路由不挂 WhenEnforced。
 */
export const memberRoutes = new Hono<{ Variables: AuthVariables }>();

const manage = requirePermission('member.manage');

/** GET /api/v1/knowledge-bases/:kbId/members */
memberRoutes.get('/knowledge-bases/:kbId/members', manage, async (c) => {
  const kbId = c.req.param('kbId');
  const kb = await documentRepo.getKb(kbId);
  if (!kb) {
    return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
  }
  const rows = await membersRepo.list(kbId);
  return ok(
    c,
    rows.map((r) => ({
      kbId: r.kbId,
      userId: r.userId,
      role: r.role,
      email: r.email ?? undefined,
      displayName: r.displayName ?? undefined,
      createdAt: r.createdAt ?? undefined,
    })),
  );
});

/** POST /api/v1/knowledge-bases/:kbId/members — 邀请 */
memberRoutes.post('/knowledge-bases/:kbId/members', manage, async (c) => {
  const kbId = c.req.param('kbId');
  const parsed = InviteMemberBodySchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
  }

  const kb = await documentRepo.getKb(kbId);
  if (!kb) {
    return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
  }

  const auth = c.get('auth');
  const tenantId = auth?.tenantId ?? kb.tenantId;
  const result = await membersRepo.invite({
    kbId,
    tenantId,
    userId: parsed.data.userId,
    email: parsed.data.email,
    role: parsed.data.role,
    createdBy: auth?.userId,
  });

  if (!result.ok) {
    if (result.reason === 'conflict') {
      return fail(c, BizCode.CONFLICT, 'already a knowledge base member', 409, {
        userId: result.userId,
        kbId,
      });
    }
    return fail(c, BizCode.NOT_FOUND, 'user not found', 404);
  }

  return ok(
    c,
    {
      kbId,
      userId: result.userId,
      role: result.role,
    },
    201,
  );
});

/** DELETE /api/v1/knowledge-bases/:kbId/members/:userId */
memberRoutes.delete('/knowledge-bases/:kbId/members/:userId', manage, async (c) => {
  const kbId = c.req.param('kbId');
  const userId = c.req.param('userId');
  const kb = await documentRepo.getKb(kbId);
  if (!kb) {
    return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
  }
  const removed = await membersRepo.remove(kbId, userId);
  if (!removed) {
    return fail(c, BizCode.NOT_FOUND, 'member not found', 404);
  }
  return ok(c, { kbId, userId, removed: true });
});
