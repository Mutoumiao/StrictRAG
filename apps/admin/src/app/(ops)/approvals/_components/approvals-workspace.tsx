'use client';

/**
 * 审批中心：待审列表 · 通过/驳回 · 通过后可 scan。
 * 无 approval.decide 时藏按钮；API 仍会 403。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DocumentListItem } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { cn } from '@strict-rag/ui/lib/utils';

import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId } from '@/lib/kb-context';

import { applyApprovalAction, loadApprovalsList, type ApprovalAction } from '../services';

type Flash = { kind: 'ok' | 'err'; text: string } | null;

export function ApprovalsWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('approval.view') || me.permissions.includes('doc.view');
  const canDecide = me.permissions.includes('approval.decide');
  const canScan = me.permissions.includes('doc.upload');

  const [rows, setRows] = useState<DocumentListItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flash, setFlash] = useState<Flash>(null);

  const load = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setRows([]);
      setState('idle');
      setError(null);
      return;
    }
    if (!canView) {
      setState('error');
      setError('无审批/文档查看权限');
      return;
    }
    setState('loading');
    setError(null);
    const result = await loadApprovalsList(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setRows(result.rows);
    setState('ready');
  }, [canView]);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = useMemo(
    () => rows.filter((r) => r.approvalStatus === 'pending'),
    [rows],
  );
  const approved = useMemo(
    () => rows.filter((r) => r.approvalStatus === 'approved'),
    [rows],
  );

  async function onAction(docId: string, action: ApprovalAction) {
    const id = readStoredKbId().trim();
    if (!id) return;
    setBusyId(docId);
    setFlash(null);
    const result = await applyApprovalAction(id, docId, action);
    if (result.ok) {
      setFlash({ kind: 'ok', text: result.text });
      setRows(result.rows);
      setState('ready');
    } else {
      setFlash({ kind: 'err', text: result.message });
    }
    setBusyId(null);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">审批中心</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </div>
      <p className="mt-0 text-[13px] text-muted-foreground">
        未审批文档不可 scan（ADR-048）。
        {canDecide ? null : ' 当前角色无 approval.decide，决定按钮已隐藏。'}
      </p>

      {flash ? (
        <p
          className={cn(
            'text-[13px]',
            flash.kind === 'ok' ? 'text-success' : 'text-destructive',
          )}
        >
          {flash.text}
        </p>
      ) : null}

      {!kbId ? <p className="text-sm text-muted-foreground">请在顶栏填写知识库 UUID。</p> : null}

      {state === 'loading' ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {state === 'error' ? <p className="text-sm text-destructive">{error}</p> : null}

      {state === 'ready' ? (
        <>
          <h2 className="mb-2 mt-5 text-[15px] font-semibold">待审 ({pending.length})</h2>
          {pending.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">无待审文档</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {pending.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2.5 border-b border-muted py-2.5"
                >
                  <div>
                    <div className="text-sm">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.id} · status={r.status}
                    </div>
                  </div>
                  {canDecide ? (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busyId === r.id}
                        onClick={() => void onAction(r.id, 'approve')}
                      >
                        通过
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        disabled={busyId === r.id}
                        onClick={() => void onAction(r.id, 'reject')}
                      >
                        驳回
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h2 className="mb-2 mt-6 text-[15px] font-semibold">
            已通过 · 可 scan ({approved.length})
          </h2>
          {approved.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">无已通过文档</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {approved.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2.5 border-b border-muted py-2.5"
                >
                  <div>
                    <div className="text-sm">{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.id} · status={r.status} · lifecycle={r.lifecycle}
                    </div>
                  </div>
                  {canScan ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busyId === r.id}
                      onClick={() => void onAction(r.id, 'scan')}
                    >
                      入队 scan
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </div>
  );
}
