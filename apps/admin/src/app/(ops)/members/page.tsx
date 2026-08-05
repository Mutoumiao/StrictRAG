'use client';

/**
 * 成员管理：列表 / 邀请 / 移除。需 member.manage（菜单亦裁剪）。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { KbMember, KbMemberRole } from '@strict-rag/contracts';

import { useAdminAuth } from '@/components/auth-guard';
import {
  inviteMember,
  listMembers,
  readStoredKbId,
  removeMember,
} from '@/lib/admin-api';
import { ApiHttpError } from '@/lib/http';

export default function MembersPage() {
  const { me } = useAdminAuth();
  const canManage = me.permissions.includes('member.manage');

  const [rows, setRows] = useState<KbMember[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<KbMemberRole>('read');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const load = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setRows([]);
      setState('idle');
      setError(null);
      return;
    }
    if (!canManage) {
      setState('error');
      setError('无 member.manage 权限');
      return;
    }
    setState('loading');
    setError(null);
    try {
      const data = await listMembers(id);
      setRows(data);
      setState('ready');
    } catch (err) {
      setState('error');
      setError(err instanceof ApiHttpError ? `${err.code}: ${err.message}` : String(err));
    }
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onInvite(e: FormEvent) {
    e.preventDefault();
    const id = readStoredKbId().trim();
    if (!id || !email.trim()) return;
    setBusy(true);
    setFlash(null);
    try {
      await inviteMember(id, { email: email.trim(), role });
      setEmail('');
      setFlash('已邀请');
      await load();
    } catch (err) {
      setFlash(err instanceof ApiHttpError ? `${err.code}: ${err.message}` : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(userId: string) {
    const id = readStoredKbId().trim();
    if (!id) return;
    setBusy(true);
    setFlash(null);
    try {
      await removeMember(id, userId);
      setFlash('已移除');
      await load();
    } catch (err) {
      setFlash(err instanceof ApiHttpError ? `${err.code}: ${err.message}` : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>成员</h1>
        <button type="button" onClick={() => void load()} style={{ fontSize: 13 }}>
          刷新
        </button>
      </div>

      {!kbId ? (
        <p style={{ color: 'var(--sr-muted, #64748b)', fontSize: 14 }}>
          请在顶栏填写知识库 UUID。
        </p>
      ) : null}

      {flash ? <p style={{ fontSize: 13 }}>{flash}</p> : null}

      {state === 'loading' ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>加载中…</p>
      ) : null}
      {state === 'error' ? (
        <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>
      ) : null}

      {canManage ? (
        <form
          onSubmit={(e) => void onInvite(e)}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'end',
            marginBottom: 20,
          }}
        >
          <label style={{ fontSize: 13 }}>
            邮箱
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ display: 'block', marginTop: 4, padding: '6px 8px', width: 220 }}
            />
          </label>
          <label style={{ fontSize: 13 }}>
            角色
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as KbMemberRole)}
              style={{ display: 'block', marginTop: 4, padding: '6px 8px' }}
            >
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
            </select>
          </label>
          <button type="submit" disabled={busy || !kbId} style={{ fontSize: 13, padding: '6px 12px' }}>
            邀请
          </button>
        </form>
      ) : null}

      {state === 'ready' && rows.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>暂无成员</p>
      ) : null}

      {rows.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 4px' }}>用户</th>
              <th style={{ padding: '8px 4px' }}>角色</th>
              <th style={{ padding: '8px 4px' }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '8px 4px' }}>
                  <div>{r.email ?? r.displayName ?? r.userId}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.userId}</div>
                </td>
                <td style={{ padding: '8px 4px' }}>{r.role}</td>
                <td style={{ padding: '8px 4px' }}>
                  {canManage ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onRemove(r.userId)}
                      style={{ fontSize: 12 }}
                    >
                      移除
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
