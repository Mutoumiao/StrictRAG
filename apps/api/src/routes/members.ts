import {
  BizCode,
  InviteMemberBodySchema,
  type InviteMemberResponse,
  type KbMember,
  type RemoveMemberResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import {
  requirePermission,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { documentRepo } from '../services/documents.js';
import { membersRepo, type MembersRepo } from '../services/members.js';

export type MemberRouteDeps = {
  members?: MembersRepo;
  getKb?: (kbId: string) => Promise<{ id: string; tenantId: string } | null>;
  resolveKbMember?: ResolveKbMember;
};

/**
 * KB 成员 CRUD（设计 §9）。
 * 始终 requirePermission('member.manage') + kb 成员（超管旁路）。
 * 与 AUTH_ENFORCE / demo-ingest 解耦：本路由不挂 WhenEnforced。
 */
export function createMemberRoutes(deps: MemberRouteDeps = {}): Hono<{ Variables: AuthVariables }> {
  const members = deps.members ?? membersRepo;
  const getKb = deps.getKb ?? ((id: string) => documentRepo.getKb(id));
  const routes = new Hono<{ Variables: AuthVariables }>();
  const manage = requirePermission('member.manage', {
    resolveKbMember: deps.resolveKbMember,
  });

  /** GET /api/v1/knowledge-bases/:kbId/members */
  routes.get('/knowledge-bases/:kbId/members', manage, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const rows = await members.list(kbId);
    const data: KbMember[] = rows.map((r) => ({
      kbId: r.kbId,
      userId: r.userId,
      role: r.role as KbMember['role'],
      email: r.email ?? undefined,
      displayName: r.displayName ?? undefined,
      createdAt: r.createdAt ?? undefined,
    }));
    return ok(c, data);
  });

  /** POST /api/v1/knowledge-bases/:kbId/members — 邀请 */
  routes.post('/knowledge-bases/:kbId/members', manage, async (c) => {
    const kbId = c.req.param('kbId');
    const parsed = InviteMemberBodySchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid body', 400, parsed.error.flatten());
    }

    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }

    const auth = c.get('auth');
    const tenantId = auth?.tenantId ?? kb.tenantId;
    const result = await members.invite({
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

    const data: InviteMemberResponse = {
      kbId,
      userId: result.userId,
      role: result.role as InviteMemberResponse['role'],
    };
    return ok(c, data, 201);
  });

  /** DELETE /api/v1/knowledge-bases/:kbId/members/:userId */
  routes.delete('/knowledge-bases/:kbId/members/:userId', manage, async (c) => {
    const kbId = c.req.param('kbId');
    const userId = c.req.param('userId');
    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const removed = await members.remove(kbId, userId);
    if (!removed) {
      return fail(c, BizCode.NOT_FOUND, 'member not found', 404);
    }
    const data: RemoveMemberResponse = { kbId, userId, removed: true };
    return ok(c, data);
  });

  return routes;
}

export const memberRoutes = createMemberRoutes();
