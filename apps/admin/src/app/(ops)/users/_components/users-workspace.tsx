'use client';

/**
 * 平台用户薄页：列表 + 新建 + 状态/角色。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PlatformRole, PlatformUser } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';

import { createUser, loadUsers, setUserRoles, updateUser } from '../services';

export function UsersWorkspace() {
  const { me } = useAdminAuth();
  const canManage = me.permissions.includes('user.manage');

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!canManage) {
      setState('error');
      setError('无 user.manage 权限');
      return;
    }
    setState('loading');
    setError(null);
    const uRes = await loadUsers();
    if (!uRes.ok) {
      setState('error');
      setError(uRes.message);
      return;
    }
    setUsers(uRes.users);
    setRoles(uRes.roles);
    setState('ready');
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleRole(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFlash(null);
    const r = await createUser({
      email,
      displayName: displayName || null,
      roleIds: selectedRoleIds,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setEmail('');
    setDisplayName('');
    setSelectedRoleIds([]);
    setFlash(`已创建 ${r.user.email}`);
    await load();
  }

  async function onToggleStatus(u: PlatformUser) {
    if (busy) return;
    setBusy(true);
    setFlash(null);
    const next = u.status === 'active' ? 'disabled' : 'active';
    const r = await updateUser(u.id, { status: next });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFlash(`${u.email} → ${next}`);
    await load();
  }

  async function onSaveRoles() {
    if (!editId || busy) return;
    setBusy(true);
    setFlash(null);
    const r = await setUserRoles(editId, { roleIds: editRoleIds });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setEditId(null);
    setFlash('角色已更新');
    await load();
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">用户</h1>
        <p className="mt-2 text-sm text-muted-foreground">403 · 无 user.manage 权限</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">平台用户</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          运营账号管理（ADR-056 最小）。登录仍走 dev-login 模板，DB 角色未接入 JWT。
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{flash}</p>
      ) : null}

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium">新建用户</h2>
        <form className="flex flex-col gap-3" onSubmit={onCreate}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ops@example.com"
              />
            </div>
            <div>
              <Label htmlFor="displayName">显示名</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>初始角色</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleIds.includes(r.id)}
                    onChange={() => setSelectedRoleIds((prev) => toggleRole(prev, r.id))}
                  />
                  {r.name}
                  <span className="text-muted-foreground">({r.code})</span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" disabled={busy || !email}>
            创建
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">用户列表</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            刷新
          </Button>
        </div>
        {state === 'loading' ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无用户（本列表仅 DB 记录；dev-login 不自动写入角色）</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-medium">{u.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {u.displayName || '—'} · {u.status} · 角色: {u.roleCodes.join(', ') || '无'}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void onToggleStatus(u)}
                  >
                    {u.status === 'active' ? '禁用' : '启用'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setEditId(u.id);
                      setEditRoleIds([...u.roleIds]);
                    }}
                  >
                    改角色
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editId ? (
        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-medium">编辑角色</h2>
          <div className="flex flex-wrap gap-2">
            {roles.map((r) => (
              <label
                key={r.id}
                className="flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 text-xs"
              >
                <input
                  type="checkbox"
                  checked={editRoleIds.includes(r.id)}
                  onChange={() => setEditRoleIds((prev) => toggleRole(prev, r.id))}
                />
                {r.name}
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void onSaveRoles()}>
              保存
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditId(null)}>
              取消
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
