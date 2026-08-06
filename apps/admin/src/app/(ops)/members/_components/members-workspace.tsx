'use client';

/**
 * 成员管理：列表 / 邀请 / 移除。需 member.manage（菜单亦裁剪）。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { KbMember, KbMemberRole } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { Select } from '@strict-rag/ui/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@strict-rag/ui/components/ui/table';

import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId } from '@/lib/kb-context';

import {
  inviteKbMemberAndReload,
  loadMemberList,
  removeKbMemberAndReload,
} from '../services';

export function MembersWorkspace() {
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
    const result = await loadMemberList(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setRows(result.rows);
    setState('ready');
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
    const result = await inviteKbMemberAndReload(id, { email: email.trim(), role });
    if (result.ok) {
      setEmail('');
      setFlash(result.text);
      setRows(result.rows);
      setState('ready');
    } else {
      setFlash(result.message);
    }
    setBusy(false);
  }

  async function onRemove(userId: string) {
    const id = readStoredKbId().trim();
    if (!id) return;
    setBusy(true);
    setFlash(null);
    const result = await removeKbMemberAndReload(id, userId);
    if (result.ok) {
      setFlash(result.text);
      setRows(result.rows);
      setState('ready');
    } else {
      setFlash(result.message);
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">成员</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </div>

      {!kbId ? <p className="text-sm text-muted-foreground">请在顶栏填写知识库 UUID。</p> : null}

      {flash ? <p className="text-[13px]">{flash}</p> : null}

      {state === 'loading' ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {state === 'error' ? <p className="text-sm text-destructive">{error}</p> : null}

      {canManage ? (
        <form onSubmit={(e) => void onInvite(e)} className="mb-5 flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="member-email">邮箱</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-[220px]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="member-role">角色</Label>
            <Select
              id="member-role"
              value={role}
              onChange={(e) => setRole(e.target.value as KbMemberRole)}
              className="w-auto"
            >
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
            </Select>
          </div>
          <Button type="submit" size="sm" disabled={busy || !kbId}>
            邀请
          </Button>
        </form>
      ) : null}

      {state === 'ready' && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无成员</p>
      ) : null}

      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-b-border">
              <TableHead>用户</TableHead>
              <TableHead>角色</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.userId}>
                <TableCell>
                  <div>{r.email ?? r.displayName ?? r.userId}</div>
                  <div className="text-[11px] text-muted-foreground">{r.userId}</div>
                </TableCell>
                <TableCell>{r.role}</TableCell>
                <TableCell>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onRemove(r.userId)}
                    >
                      移除
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
