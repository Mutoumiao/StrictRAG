/**
 * 数据面板：无码 403 态；有码加载 summary。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-admin',
  email: 'admin@example.com',
  permissions: [] as string[],
};

const loadDashboardSummary = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-admin', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('../services', () => ({
  loadDashboardSummary: (...args: unknown[]) => loadDashboardSummary(...args),
}));

import { DashboardWorkspace } from './dashboard-workspace';

describe('DashboardWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDashboardSummary.mockReset();
  });

  it('无 dashboard.view → 403 态，不请求 summary', async () => {
    me.permissions = ['admin.shell', 'doc.view'];
    render(<DashboardWorkspace />);
    expect(screen.getByText(/403 · 无 dashboard\.view 权限/)).toBeInTheDocument();
    expect(loadDashboardSummary).not.toHaveBeenCalled();
  });

  it('有 dashboard.view → 展示指标', async () => {
    me.permissions = ['admin.shell', 'dashboard.view'];
    loadDashboardSummary.mockResolvedValue({
      ok: true,
      summary: {
        kbCount: 3,
        documentCount: 12,
        pendingApprovalCount: 1,
        processReady: true,
        askCount24h: 5,
      },
    });
    render(<DashboardWorkspace />);
    await waitFor(() => {
      expect(screen.getByText('知识库')).toBeInTheDocument();
    });
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('就绪')).toBeInTheDocument();
    expect(loadDashboardSummary).toHaveBeenCalledTimes(1);
  });
});
