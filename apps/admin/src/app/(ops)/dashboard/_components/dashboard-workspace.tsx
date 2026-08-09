'use client';

/**
 * 数据面板薄页：只读 3–5 指标；无 dashboard.view 时 403 态。
 */

import { useCallback, useEffect, useState } from 'react';
import type { DashboardSummary } from '@strict-rag/contracts';

import { useAdminAuth } from '@/components/auth-guard';

import { loadDashboardSummary } from '../services';

const METRIC_LABELS: Array<{ key: keyof DashboardSummary; label: string }> = [
  { key: 'kbCount', label: '知识库' },
  { key: 'documentCount', label: '文档' },
  { key: 'pendingApprovalCount', label: '待审文档' },
  { key: 'processReady', label: '进程就绪' },
  { key: 'askCount24h', label: '近 24h 问答' },
];

export function DashboardWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('dashboard.view');

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!canView) {
      setState('error');
      setError('无 dashboard.view 权限');
      return;
    }
    setState('loading');
    setError(null);
    const r = await loadDashboardSummary();
    if (!r.ok) {
      setState('error');
      setError(r.message);
      return;
    }
    setSummary(r.summary);
    setState('ready');
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canView) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">数据面板</h1>
        <p className="mt-2 text-sm text-muted-foreground">403 · 无 dashboard.view 权限</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-lg font-semibold">数据面板</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          只读运营摘要（薄壳）。非 APM / 时序大盘。
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
    </div>
  );
}
