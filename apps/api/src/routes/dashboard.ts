import { DashboardSummarySchema } from '@strict-rag/contracts';
import { Hono } from 'hono';

import { requirePermission, type AuthVariables } from '../auth/middleware.js';
import { ok } from '../lib/response.js';
import {
  dashboardRepo,
  getDashboardSummary,
  type DashboardRepo,
} from '../services/dashboard.js';

export type DashboardRouteDeps = {
  repo?: DashboardRepo;
};

/**
 * B6 数据面板只读 summary。
 * 始终 requirePermission('dashboard.view')——不走 AUTH_ENFORCE 旁路。
 */
export function createDashboardRoutes(
  deps: DashboardRouteDeps = {},
): Hono<{ Variables: AuthVariables }> {
  const repo = deps.repo ?? dashboardRepo;
  const routes = new Hono<{ Variables: AuthVariables }>();
  const view = requirePermission('dashboard.view');

  routes.get('/admin/dashboard/summary', view, async (c) => {
    const summary = await getDashboardSummary(repo);
    const data = DashboardSummarySchema.parse(summary);
    return ok(c, data);
  });

  return routes;
}

export const dashboardRoutes = createDashboardRoutes();
