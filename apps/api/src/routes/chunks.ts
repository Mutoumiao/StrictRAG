import {
  BizCode,
  ChunkListQuerySchema,
  type ChunkDetail,
  type ChunkListItem,
  type ChunkListResponse,
} from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import {
  buildBody,
  buildPreview,
  chunksRepo,
  type ChunkRow,
  type ChunksRepo,
} from '../services/chunks.js';
import {
  isDeptAclEnforced,
  isDocVisibleForDeptAcl,
  loadDeptAssignments,
} from '../services/retrieve/dept-acl.js';

export type ChunkRouteDeps = {
  chunks?: ChunksRepo;
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

/**
 * 分片只读（ADR-052 / B1）。
 * 始终 requirePermission('chunk.view')——与 members 同纪律，不走 AUTH_ENFORCE 旁路。
 */
export function createChunkRoutes(deps: ChunkRouteDeps = {}): Hono<{ Variables: AuthVariables }> {
  const repo = deps.chunks ?? chunksRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const view = requirePermission('chunk.view');

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
    if (isDeptAclEnforced()) {
      const assignments = await loadDeptAssignments(doc.tenantId, c.get('auth')?.userId);
      if (!isDocVisibleForDeptAcl(doc, assignments, true)) {
        return fail(c, BizCode.FORBIDDEN, 'department acl denied', 403);
      }
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
    if (isDeptAclEnforced()) {
      const assignments = await loadDeptAssignments(doc.tenantId, c.get('auth')?.userId);
      if (!isDocVisibleForDeptAcl(doc, assignments, true)) {
        return fail(c, BizCode.FORBIDDEN, 'department acl denied', 403);
      }
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
