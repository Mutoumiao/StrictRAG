import { BizCode, type IngestReportItem } from '@strict-rag/contracts';
import { Hono } from 'hono';

import {
  requireKbMember,
  requirePermissionWhenEnforced,
  type AuthVariables,
  type ResolveKbMember,
} from '../auth/middleware.js';
import { fail, ok } from '../lib/response.js';
import { documentRepo } from '../services/documents.js';
import { ingestReportsRepo, type IngestReportRepo } from '../services/ingest-reports.js';

export type IngestReportRouteDeps = {
  resolveKbMember?: ResolveKbMember;
  getKb?: (id: string) => Promise<{ id: string } | null>;
  reportRepo?: IngestReportRepo;
};

export function createIngestReportRoutes(deps: IngestReportRouteDeps = {}) {
  const routes = new Hono<{ Variables: AuthVariables }>();
  const getKb = deps.getKb ?? (async (id) => documentRepo.getKb(id));
  const reportRepo = deps.reportRepo ?? ingestReportsRepo;
  const memberMw = requireKbMember({ resolveKbMember: deps.resolveKbMember });
  const permMw = requirePermissionWhenEnforced('doc.view', {
    resolveKbMember: deps.resolveKbMember,
  });

  /** GET /api/v1/knowledge-bases/:kbId/ingest-report — 该库已落库行；空列表 200 */
  routes.get('/knowledge-bases/:kbId/ingest-report', memberMw, permMw, async (c) => {
    const kbId = c.req.param('kbId');
    const kb = await getKb(kbId);
    if (!kb) {
      return fail(c, BizCode.NOT_FOUND, 'knowledge base not found', 404);
    }
    const data: IngestReportItem[] = await reportRepo.listByKb(kbId);
    return ok(c, data);
  });

  return routes;
}

export const ingestReportRoutes = createIngestReportRoutes();
