/**
 * 目标：数据面板无码须保持 403、有码才加载 summary 与双轨；失败则指标页对无权限可见。
 * 需求：B6 UI · 剧本 I4
 * 被测：DashboardWorkspace
 * 简介：指标真值在 api。质量/延迟分区只读。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen, waitFor } from '@/test/test-utils';

const me = {
  userId: 'u-admin',
  email: 'admin@example.com',
  permissions: [] as string[],
};

const loadDashboardSummary = vi.fn();
const loadDashboardTracks = vi.fn();

vi.mock('@/components/auth-guard', () => ({
  useAdminAuth: () => ({
    me,
    session: { sessionId: 's', userId: 'u-admin', roles: [], expiresAt: '' },
    refresh: vi.fn(),
  }),
}));

vi.mock('@/app/(ops)/dashboard/services', () => ({
  loadDashboardSummary: (...args: unknown[]) => loadDashboardSummary(...args),
  loadDashboardTracks: (...args: unknown[]) => loadDashboardTracks(...args),
}));

import { DashboardWorkspace } from '@/app/(ops)/dashboard/_components/dashboard-workspace';

const emptyTracks = {
  quality: {
    evalRunId: null,
    retrieveMode: null,
    matrix: null,
    coverage: null,
    hitAtK: null,
    tauStar: null,
    judgeAuroc: null,
  },
  latency: {
    windowHours: 24 as const,
    askCount: 0,
    scoredCount: 0,
    avgMs: null,
    p95Ms: null,
  },
};

describe('DashboardWorkspace', () => {
  beforeEach(() => {
    me.permissions = [];
    loadDashboardSummary.mockReset();
    loadDashboardTracks.mockReset();
    loadDashboardTracks.mockResolvedValue({ ok: true, tracks: emptyTracks });
  });

  it('无 dashboard.view → 403 态，不请求 summary 或 tracks', async () => {
    me.permissions = ['admin.shell', 'doc.view'];
    render(<DashboardWorkspace />);
    expect(screen.getByText(/403 · 无 dashboard\.view 权限/)).toBeInTheDocument();
    expect(loadDashboardSummary).not.toHaveBeenCalled();
    expect(loadDashboardTracks).not.toHaveBeenCalled();
  });

  it('有 dashboard.view → 展示指标与质量/延迟分区', async () => {
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
    expect(screen.getByRole('heading', { name: '质量' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '延迟' })).toBeInTheDocument();
    expect(screen.getByText('暂无 L1 跑批')).toBeInTheDocument();
    expect(loadDashboardSummary).toHaveBeenCalledTimes(1);
    expect(loadDashboardTracks).toHaveBeenCalledTimes(1);
  });

  it('有 L1 数字时质量区可见矩阵 A', async () => {
    me.permissions = ['admin.shell', 'dashboard.view'];
    loadDashboardSummary.mockResolvedValue({
      ok: true,
      summary: {
        kbCount: 1,
        documentCount: 1,
        pendingApprovalCount: 0,
        processReady: true,
        askCount24h: 0,
      },
    });
    loadDashboardTracks.mockResolvedValue({
      ok: true,
      tracks: {
        quality: {
          evalRunId: '01900000-0000-7000-8000-0000000000aa',
          retrieveMode: 'mock',
          matrix: { A: 10, B: 20, C: 0, D: 30 },
          coverage: 0.33,
          hitAtK: 0.5,
          tauStar: 0.45,
          judgeAuroc: 0.8,
        },
        latency: {
          windowHours: 24,
          askCount: 4,
          scoredCount: 4,
          avgMs: 100,
          p95Ms: 180,
        },
      },
    });
    render(<DashboardWorkspace />);
    await waitFor(() => {
      expect(screen.getByText(/A 10/)).toBeInTheDocument();
    });
    expect(screen.getByText('0.8')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('summary 失败仍可见质量/延迟', async () => {
    me.permissions = ['admin.shell', 'dashboard.view'];
    loadDashboardSummary.mockResolvedValue({ ok: false, message: 'summary down' });
    loadDashboardTracks.mockResolvedValue({
      ok: true,
      tracks: {
        quality: {
          evalRunId: '01900000-0000-7000-8000-0000000000aa',
          retrieveMode: 'live',
          matrix: { A: 4, B: 1, C: 0, D: 5 },
          coverage: 0.8,
          hitAtK: null,
          tauStar: null,
          judgeAuroc: null,
        },
        latency: emptyTracks.latency,
      },
    });
    render(<DashboardWorkspace />);
    await waitFor(() => {
      expect(screen.getByText('summary down')).toBeInTheDocument();
    });
    expect(screen.getByRole('heading', { name: '质量' })).toBeInTheDocument();
    expect(screen.getByText(/A 4/)).toBeInTheDocument();
  });

  it('tracks 失败仍见 summary，且不得写成暂无 L1', async () => {
    me.permissions = ['admin.shell', 'dashboard.view'];
    loadDashboardSummary.mockResolvedValue({
      ok: true,
      summary: {
        kbCount: 2,
        documentCount: 3,
        pendingApprovalCount: 0,
        processReady: true,
        askCount24h: 1,
      },
    });
    loadDashboardTracks.mockResolvedValue({ ok: false, message: 'tracks down' });
    render(<DashboardWorkspace />);
    await waitFor(() => {
      expect(screen.getByText('知识库')).toBeInTheDocument();
    });
    expect(screen.getByText(/双轨看板加载失败：tracks down/)).toBeInTheDocument();
    expect(screen.queryByText('暂无 L1 跑批')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '质量' })).not.toBeInTheDocument();
  });
});
