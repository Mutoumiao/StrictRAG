'use client';

/**
 * 审批中心：待审列表 · 通过/驳回 · 通过后可 scan。
 * 无 approval.decide 时藏按钮；API 仍会 403。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAdminAuth } from '@/components/auth-guard';
import {
  approveDocument,
  listDocuments,
  readStoredKbId,
  rejectDocument,
  scanDocument,
  type DocRow,
} from '@/lib/admin-api';
import { ApiHttpError } from '@/lib/http';

type Flash = { kind: 'ok' | 'err'; text: string } | null;

export default function ApprovalsPage() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('approval.view') || me.permissions.includes('doc.view');
  const canDecide = me.permissions.includes('approval.decide');
  const canScan = me.permissions.includes('doc.upload');

  const [rows, setRows] = useState<DocRow[]>([]);
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
    try {
      const data = await listDocuments(id);
      setRows(data);
      setState('ready');
    } catch (err) {
      setState('error');
      setError(err instanceof ApiHttpError ? `${err.code}: ${err.message}` : String(err));
    }
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

  async function runAction(
    docId: string,
    action: 'approve' | 'reject' | 'scan',
  ) {
    setBusyId(docId);
    setFlash(null);
    try {
      if (action === 'approve') await approveDocument(docId);
      else if (action === 'reject') await rejectDocument(docId);
      else await scanDocument(docId);
      setFlash({
        kind: 'ok',
        text:
          action === 'approve'
            ? '已通过（尚未 scan；未批不可 scan）'
            : action === 'reject'
              ? '已驳回'
              : '已入队 scan',
      });
      await load();
    } catch (err) {
      const text =
        err instanceof ApiHttpError ? `${err.code}: ${err.message}` : String(err);
      setFlash({ kind: 'err', text });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>审批中心</h1>
        <button type="button" onClick={() => void load()} style={{ fontSize: 13 }}>
          刷新
        </button>
      </div>
      <p style={{ fontSize: 13, color: 'var(--sr-muted, #64748b)', marginTop: 0 }}>
        未审批文档不可 scan（ADR-048）。
        {canDecide ? null : ' 当前角色无 approval.decide，决定按钮已隐藏。'}
      </p>

      {flash ? (
        <p
          style={{
            fontSize: 13,
            color: flash.kind === 'ok' ? '#15803d' : '#b91c1c',
          }}
        >
          {flash.text}
        </p>
      ) : null}

      {!kbId ? (
        <p style={{ color: 'var(--sr-muted, #64748b)', fontSize: 14 }}>
          请在顶栏填写知识库 UUID。
        </p>
      ) : null}

      {state === 'loading' ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>加载中…</p>
      ) : null}
      {state === 'error' ? (
        <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>
      ) : null}

      {state === 'ready' ? (
        <>
          <h2 style={{ fontSize: 15, margin: '20px 0 8px' }}>待审 ({pending.length})</h2>
          {pending.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--sr-muted, #64748b)' }}>无待审文档</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {pending.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {r.id} · status={r.status}
                    </div>
                  </div>
                  {canDecide ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void runAction(r.id, 'approve')}
                        style={{ fontSize: 13 }}
                      >
                        通过
                      </button>
                      <button
                        type="button"
                        disabled={busyId === r.id}
                        onClick={() => void runAction(r.id, 'reject')}
                        style={{ fontSize: 13 }}
                      >
                        驳回
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <h2 style={{ fontSize: 15, margin: '24px 0 8px' }}>
            已通过 · 可 scan ({approved.length})
          </h2>
          {approved.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--sr-muted, #64748b)' }}>无已通过文档</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {approved.map((r) => (
                <li
                  key={r.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 14 }}>{r.title}</div>
                    <div style={{ fontSize: 11, color: '#94a3b8' }}>
                      {r.id} · status={r.status} · lifecycle={r.lifecycle}
                    </div>
                  </div>
                  {canScan ? (
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => void runAction(r.id, 'scan')}
                      style={{ fontSize: 13 }}
                    >
                      入队 scan
                    </button>
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
