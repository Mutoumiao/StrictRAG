'use client';

/**
 * 数据面板薄页：B6 只读 3–5 指标 + I4 质量/延迟两区块；无 dashboard.view 时 403 态。
 */

import { useCallback, useEffect, useState } from 'react';
import type { DashboardSummary, DashboardTracks } from '@strict-rag/contracts';

import { useAdminAuth } from '@/components/auth-guard';

import { loadDashboardSummary, loadDashboardTracks } from '../services';

const METRIC_LABELS: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: 'kbCount', label: '知识库' },
  { key: 'documentCount', label: '文档' },
  { key: 'pendingApprovalCount', label: '待审文档' },
  { key: 'processReady', label: '进程就绪' },
  { key: 'askCount24h', label: '近 24h 问答' },
];

function fmtNum(value: number | null | undefined): string {
  if (value === null || value === undefined) return '无';
  return String(value);
}

export function DashboardWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('dashboard.view');

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tracks, setTracks] = useState<DashboardTracks | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [tracksError, setTracksError] = useState<string | null>(null);

  const load = useCallback(async (alive: { current: boolean }) => {
    if (!canView) {
      setState('error');
      setError('无 dashboard.view 权限');
      return;
    }
    setState('loading');
    setError(null);
    setTracksError(null);
    const [summaryResult, tracksResult] = await Promise.all([
      loadDashboardSummary(),
      loadDashboardTracks(),
    ]);
    if (!alive.current) return;
    if (summaryResult.ok) {
      setSummary(summaryResult.summary);
      setState('ready');
    } else {
      setSummary(null);
      setState('error');
      setError(summaryResult.message);
    }
    if (tracksResult.ok) {
      setTracks(tracksResult.tracks);
    } else {
      setTracks(null);
      setTracksError(tracksResult.message);
    }
  }, [canView]);

  useEffect(() => {
    const alive = { current: true };
    void load(alive);
    return () => {
      alive.current = false;
    };
  }, [load]);

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">数据面板</h1>
        <p className="mt-2 text-sm text-muted-foreground">403 · 无 dashboard.view 权限</p>
      </div>
    );
  }

  const quality = tracks?.quality;
  const latency = tracks?.latency;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">数据面板</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          只读运营摘要（薄壳）。非 APM / 时序大盘。质量来自最近一笔 L1 工程账本，不是准出 PASS。
        </p>
      </header>

      {state === 'loading' && (
        <p className="text-sm text-muted-foreground">加载中…</p>
      )}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {summary && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {METRIC_LABELS.map(({ key, label }) => {
            const value = summary[key];
            if (value === undefined) return null;
            const display =
              typeof value === 'boolean' ? (value ? '就绪' : '未就绪') : String(value);
            return (
              <li
                key={key}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{display}</p>
              </li>
            );
          })}
        </ul>
      )}

      {tracksError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          双轨看板加载失败：{tracksError}
        </p>
      )}

      {tracks && <section className="space-y-3">
        <h2 className="text-base font-semibold">质量</h2>
        <p className="text-xs text-muted-foreground">最近一笔成功 L1。不是签字 PASS。</p>
        {quality?.evalRunId && quality.matrix ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">2×2</p>
              <p className="mt-1 text-sm tabular-nums">
                A {quality.matrix.A} · B {quality.matrix.B} · C {quality.matrix.C} · D{' '}
                {quality.matrix.D}
              </p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">coverage</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(quality.coverage)}</p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">Hit@k</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(quality.hitAtK)}</p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">tau*</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(quality.tauStar)}</p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">auroc</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {fmtNum(quality.judgeAuroc)}
              </p>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">暂无 L1 跑批</p>
        )}
      </section>}

      {tracks && <section className="space-y-3">
        <h2 className="text-base font-semibold">延迟</h2>
        <p className="text-xs text-muted-foreground">近 24h ask_traces。不是 APM 时序。</p>
        {latency ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">问答次数</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{latency.askCount}</p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">有效样本</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{latency.scoredCount}</p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">平均 ms</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(latency.avgMs)}</p>
            </li>
            <li className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">p95 ms</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{fmtNum(latency.p95Ms)}</p>
            </li>
          </ul>
        ) : null}
      </section>}
    </div>
  );
}
