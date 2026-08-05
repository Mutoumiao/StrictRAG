'use client';

/**
 * 文档薄列表：status / approval / lifecycle。
 * 审批动作在 /approvals；此处只读刷新。
 */

import { useCallback, useEffect, useState } from 'react';

import { useAdminAuth } from '@/components/auth-guard';
import {
  listDocuments,
  readStoredKbId,
  type DocRow,
} from '@/lib/admin-api';
import { ApiHttpError } from '@/lib/http';

export default function DocumentsPage() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('doc.view');
  const [rows, setRows] = useState<DocRow[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');

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
      setError('无 doc.view 权限');
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
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>文档</h1>
        <button type="button" onClick={() => void load()} style={{ fontSize: 13 }}>
          刷新
        </button>
      </div>

      {!kbId ? (
        <p style={{ color: 'var(--sr-muted, #64748b)', fontSize: 14 }}>
          请在顶栏填写知识库 UUID 后刷新。
        </p>
      ) : null}

      {state === 'loading' ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>加载中…</p>
      ) : null}
      {state === 'error' ? (
        <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>
      ) : null}
      {state === 'ready' && rows.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>暂无文档</p>
      ) : null}

      {rows.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 4px' }}>标题</th>
              <th style={{ padding: '8px 4px' }}>status</th>
              <th style={{ padding: '8px 4px' }}>approval</th>
              <th style={{ padding: '8px 4px' }}>lifecycle</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 4px' }}>
                  <div>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.id}</div>
                </td>
                <td style={{ padding: '8px 4px' }}>{r.status}</td>
                <td style={{ padding: '8px 4px' }}>{r.approvalStatus}</td>
                <td style={{ padding: '8px 4px' }}>{r.lifecycle}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
