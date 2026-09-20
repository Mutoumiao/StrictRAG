import {
  BizCode,
  ChunkListQuerySchema,
  type ChunkDetail,
  type ChunkListItem,
  type ChunkListResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { createDocMemberGate } from '../auth/doc-scope.js';
import {
  requirePermission,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { roleBypassesKbMembership } from '../auth/permissions/resolve.js';
import { fail, ok } from '../lib/response.js';
import { logger } from '../logger.js';
import {
  buildBody,
  buildPreview,
  chunksRepo,
  type ChunkRow,
  type ChunksRepo,
  type DocChunkContext,
} from '../services/chunks.js';
import { documentRepo } from '../services/documents.js';
import {
  parseDeptAclEnforceFromConfig,
  parseDeptInheritDownFromConfig,
  resolveDeptAclEnforce,
  resolveDeptInheritDown,
} from '../services/kb-settings.js';
import {
  isDocVisibleForDeptAcl,
  loadDeptAssignments,
  loadDeptGrants,
  loadDeptNodes,
} from '../services/retrieve/dept-acl.js';
import { isDocVisibleForAclPrincipals } from '../services/retrieve/doc-acl.js';

export type ChunkRouteDeps = {
  chunks?: ChunksRepo;
  /** 文档级成员闸的成员解析；默认查 kb_members，测例注入内存实现 */
  resolveKbMember?: ResolveKbMember;
};

function toListItem(row: ChunkRow): ChunkListItem {
  const { preview, previewTruncated } = buildPreview(row);
  return {
    chunkId: row.id,
    ordinal: row.ordinal,
    preview,
    previewTruncated,
    indexVersion: row.indexVersion,
    tokenCount: row.tokenCount,
  };
}

/** 部门闸之后 principals；不可见返回 403 文案。不跟 DEPT_ACL_ENFORCE。 */
async function deniedDocReadMessage(
  doc: DocChunkContext,
  kb: { configJson?: Record<string, unknown> | null } | null,
  auth: { userId?: string; roles?: string[] } | null | undefined,
): Promise<string | null> {
  const enforce = resolveDeptAclEnforce(
    parseDeptAclEnforceFromConfig(kb?.configJson ?? null),
  );
  const bypass = roleBypassesKbMembership(auth?.roles ?? []);
  if (enforce) {
    if (bypass) {
      logger.info(
        { event: 'dept_acl_bypass', userId: auth?.userId, docId: doc.id },
        'dept acl bypass',
      );
    } else {
      const [assignments, depts, grants] = await Promise.all([
        loadDeptAssignments(doc.tenantId, auth?.userId),
        loadDeptNodes(doc.tenantId),
        loadDeptGrants(doc.tenantId, auth?.userId),
      ]);
      const inheritDown = resolveDeptInheritDown(
        parseDeptInheritDownFromConfig(kb?.configJson ?? null),
      );
      if (
        !isDocVisibleForDeptAcl(
          doc,
          assignments,
          true,
          depts,
          grants,
          undefined,
          undefined,
          inheritDown,
        )
      ) {
        return 'department acl denied';
      }
    }
  }
  if (!isDocVisibleForAclPrincipals(doc, { userId: auth?.userId, bypass })) {
    return 'document acl denied';
  }
  return null;
}

/**
 * 分片只读（ADR-052 / B1）。
 * 始终 requirePermission('chunk.view')——与 members 同纪律，不走 AUTH_ENFORCE 旁路。
 */
export function createChunkRoutes(deps: ChunkRouteDeps = {}): Hono<{ Variables: AuthVariables }> {
  const repo = deps.chunks ?? chunksRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const view = requirePermission('chunk.view');
  /** 文档级 KB 成员闸（`chunk.view` 是硬姿态 → 始终查）；先于部门 / 名单第二层闸 */
  const docMemberDenied = createDocMemberGate(deps);

  /** GET /api/v1/documents/:docId/chunks */
  routes.get('/documents/:docId/chunks', view, async (c) => {
    const docId = c.req.param('docId');
    const parsed = ChunkListQuerySchema.safeParse({
      limit: c.req.query('limit'),
      cursor: c.req.query('cursor'),
    });
    if (!parsed.success) {
      return fail(c, BizCode.VALIDATION_ERROR, 'invalid query', 400, parsed.error.flatten());
    }

    const doc = await repo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    const memberDenied = await docMemberDenied(c, doc.kbId ?? '', 'always');
    if (memberDenied) return memberDenied;

    const kb = doc.kbId ? await documentRepo.getKb(doc.kbId) : null;
    const denied = await deniedDocReadMessage(doc, kb, c.get('auth'));
    if (denied) {
      return fail(c, BizCode.FORBIDDEN, denied, 403);
    }

    const rows = await repo.listByDocVersion({
      docId,
      indexVersion: doc.indexVersion,
      limit: parsed.data.limit,
      cursorOrdinal: parsed.data.cursor,
    });

    const items = rows.map(toListItem);
    const last = rows[rows.length - 1];
    const data: ChunkListResponse = {
      docId,
      indexVersion: doc.indexVersion,
      status: doc.status,
      lifecycle: doc.lifecycle,
      items,
      // nextCursor 用 ordinal 字符串，客户端原样回传 query
      nextCursor:
        rows.length === parsed.data.limit && last !== undefined ? String(last.ordinal) : null,
    };
    return ok(c, data);
  });

  /** GET /api/v1/documents/:docId/chunks/:chunkId */
  routes.get('/documents/:docId/chunks/:chunkId', view, async (c) => {
    const docId = c.req.param('docId');
    const chunkId = c.req.param('chunkId');

    const doc = await repo.getDoc(docId);
    if (!doc) {
      return fail(c, BizCode.NOT_FOUND, 'document not found', 404);
    }
    const memberDenied = await docMemberDenied(c, doc.kbId ?? '', 'always');
    if (memberDenied) return memberDenied;

    const kb = doc.kbId ? await documentRepo.getKb(doc.kbId) : null;
    const denied = await deniedDocReadMessage(doc, kb, c.get('auth'));
    if (denied) {
      return fail(c, BizCode.FORBIDDEN, denied, 403);
    }

    const row = await repo.getById(docId, chunkId, doc.indexVersion);
    if (!row) {
      return fail(c, BizCode.NOT_FOUND, 'chunk not found', 404);
    }

    const base = toListItem(row);
    const { body, bodyTruncated } = buildBody(row);
    const data: ChunkDetail = { ...base, body, bodyTruncated };
    return ok(c, data);
  });

  return routes;
}

export const chunkRoutes = createChunkRoutes();
