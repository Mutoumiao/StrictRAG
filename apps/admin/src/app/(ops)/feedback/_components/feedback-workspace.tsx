'use client';

/**
 * B13：反馈队列处理（API 已有；本页薄壳）。
 * 无 feedback.queue 码 → 提示；API 仍 403。
 * SLA：1 工作日内处理 open 项（见 docs/ops/feedback-sla.md）。
 */

import { useCallback, useEffect, useState } from 'react';
import type { FeedbackItem } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';

import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId } from '@/lib/kb-context';

import { loadFeedbackQueue, resolveFeedback } from '../services';

export function FeedbackWorkspace() {
  const { me } = useAdminAuth();
  const canQueue = me.permissions.includes('feedback.queue');

  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setItems([]);
      setState('idle');
      setError(null);
      return;
    }
    if (!canQueue) {
      setState('error');
      setError('无 feedback.queue 权限（API 将 403）');
      return;
    }
    setState('loading');
    setError(null);
    const result = await loadFeedbackQueue(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setItems(result.items);
    setState('ready');
  }, [canQueue]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onResolve(id: string, status: FeedbackItem['status']) {
    setBusyId(id);
    setFlash(null);
    const r = await resolveFeedback(id, status);
    if (!r.ok) {
      setFlash(r.message);
      setBusyId(null);
      return;
    }
    setFlash(`已更新为 ${status}`);
    setBusyId(null);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <header>
        <h1 className="m-0 text-lg font-semibold">反馈队列</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          KB：{kbId || '（顶部填写）'} · open 项目标 1 工作日内处理（见 ops/feedback-sla）
        </p>
      </header>

      {flash ? <p className="text-sm text-muted-foreground">{flash}</p> : null}
      {state === 'loading' ? <p className="text-sm">加载中…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {state === 'ready' && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无反馈</p>
      ) : null}

      <ul className="m-0 list-none space-y-3 p-0">
        {items.map((it) => (
          <li key={it.feedbackId} className="rounded-md border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="font-mono text-xs">{it.requestId.slice(0, 12)}…</strong>
              <span className="text-xs text-muted-foreground">
                {it.status} · {it.rating ?? '—'}
              </span>
            </div>
            {it.comment ? <p className="mt-1 mb-0 text-muted-foreground">{it.comment}</p> : null}
            {it.status === 'open' && canQueue ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === it.feedbackId}
                  onClick={() => void onResolve(it.feedbackId, 'dismissed')}
                >
                  忽略
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === it.feedbackId}
                  onClick={() => void onResolve(it.feedbackId, 'linked_doc')}
                >
                  已关联文档
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
