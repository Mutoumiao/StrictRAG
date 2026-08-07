'use client';

/**
 * 角色与权限薄页：系统/自定义角色 + 权限码勾选。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { PermissionCatalogItem, PlatformRole } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';

import { createRole, loadRolesPage, saveRolePermissions } from '../services';

export function RolesWorkspace() {
  const { me } = useAdminAuth();
  const canManage = me.permissions.includes('role.perm.manage');

  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [catalog, setCatalog] = useState<PermissionCatalogItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editCodes, setEditCodes] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!canManage) {
      setState('error');
      setError('无 role.perm.manage 权限');
      return;
    }
    setState('loading');
    setError(null);
    const r = await loadRolesPage();
    if (!r.ok) {
      setState('error');
      setError(r.message);
      return;
    }
    setRoles(r.roles);
    setCatalog(r.catalog);
    setState('ready');
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleCode(list: string[], c: string): string[] {
    return list.includes(c) ? list.filter((x) => x !== c) : [...list, c];
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFlash(null);
    const r = await createRole({ code, name, codes: [] });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setCode('');
    setName('');
    setFlash(`已创建角色 ${r.role.code}`);
    setEditId(r.role.id);
    setEditCodes([]);
    await load();
  }

  async function onSavePerms() {
    if (!editId || busy) return;
    setBusy(true);
    setFlash(null);
    const r = await saveRolePermissions(editId, { codes: editCodes });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFlash(`已保存 ${r.role.code} 权限（${r.role.codes.length} 项）`);
    await load();
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">角色与权限</h1>
        <p className="mt-2 text-sm text-muted-foreground">403 · 无 role.perm.manage 权限</p>
      </div>
    );
  }

  const editing = roles.find((r) => r.id === editId) ?? null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">角色与权限</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          树状授码 · codes ⊆ admin-catalog（ADR-056 最小）
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
        <h2 className="mb-3 text-sm font-medium">新建自定义角色</h2>
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onCreate}>
          <div className="flex-1">
            <Label htmlFor="roleCode">code（snake_case）</Label>
            <Input
              id="roleCode"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="custom_ops"
            />
          </div>
          <div className="flex-1">
            <Label htmlFor="roleName">名称</Label>
            <Input
              id="roleName"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="自定义运营"
            />
          </div>
          <Button type="submit" disabled={busy || !code || !name}>
            创建
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">角色列表</h2>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={busy}>
            刷新
          </Button>
        </div>
        {state === 'loading' ? (
          <p className="text-sm text-muted-foreground">加载中…</p>
        ) : (
          <ul className="divide-y divide-border">
            {roles.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium">
                    {r.name}{' '}
                    <span className="text-xs font-normal text-muted-foreground">
                      {r.code}
                      {r.isSystem ? ' · 系统' : ''}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">{r.codes.length} 个权限码</div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={editId === r.id ? 'default' : 'outline'}
                  onClick={() => {
                    setEditId(r.id);
                    setEditCodes([...r.codes]);
                  }}
                >
                  授码
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? (
        <section className="rounded-lg border border-border p-4">
          <h2 className="mb-3 text-sm font-medium">
            权限码 · {editing.name} ({editing.code})
          </h2>
          <div className="grid max-h-80 gap-1 overflow-y-auto sm:grid-cols-2">
            {catalog.map((p) => (
              <label
                key={p.code}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 text-xs hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={editCodes.includes(p.code)}
                  onChange={() => setEditCodes((prev) => toggleCode(prev, p.code))}
                />
                <span>
                  <span className="font-medium">{p.code}</span>
                  <span className="block text-muted-foreground">
                    {p.scope} · {p.kind} · {p.description}
                  </span>
                </span>
              </label>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="button" disabled={busy} onClick={() => void onSavePerms()}>
              保存权限
            </Button>
            <Button type="button" variant="outline" onClick={() => setEditId(null)}>
              关闭
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
