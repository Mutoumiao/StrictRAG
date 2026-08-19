'use client';

/**
 * 部门组织薄页：树列表 + 用户归属 + 跨部门授权表。
 * 表可配，检索是否消费另见开关。不宣称 DEPT_ACL 检索强制。
 */

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type {
  Department,
  DepartmentTreeNode,
  DeptCrossGrant,
  VisibilityLevel,
} from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';

import {
  createDept,
  createGrant,
  loadDeptWorkspace,
  loadGrants,
  loadUserDepts,
  removeDept,
  removeGrant,
  saveUserDepts,
  updateDept,
} from '../services';

const VISIBILITY_LEVELS: VisibilityLevel[] = [10, 20, 30, 40];

function flattenTree(
  nodes: DepartmentTreeNode[],
  depth = 0,
): Array<Department & { depth: number }> {
  const out: Array<Department & { depth: number }> = [];
  for (const n of nodes) {
    const { children, ...rest } = n;
    out.push({ ...rest, depth });
    out.push(...flattenTree(children, depth + 1));
  }
  return out;
}

export function DepartmentsWorkspace() {
  const { me } = useAdminAuth();
  const canManage = me.permissions.includes('dept.manage');
  const canUser = me.permissions.includes('user.manage');

  const [tree, setTree] = useState<DepartmentTreeNode[]>([]);
  const [flat, setFlat] = useState<Department[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [parentId, setParentId] = useState('');

  const [assignUserId, setAssignUserId] = useState('');
  const [assignDeptId, setAssignDeptId] = useState('');
  const [assignPrimary, setAssignPrimary] = useState(true);
  const [assignLeader, setAssignLeader] = useState(false);
  const [assignView, setAssignView] = useState<string | null>(null);

  const [grants, setGrants] = useState<DeptCrossGrant[]>([]);
  const [grantLoadError, setGrantLoadError] = useState(false);
  const grantGen = useRef(0);
  const [grantUserId, setGrantUserId] = useState('');
  const [grantDeptId, setGrantDeptId] = useState('');
  const [grantLevel, setGrantLevel] = useState<VisibilityLevel>(20);
  const [grantExpires, setGrantExpires] = useState('');
  const [grantReason, setGrantReason] = useState('');

  const load = useCallback(async () => {
    if (!canManage) {
      setState('error');
      setError('无 dept.manage 权限');
      return;
    }
    setState('loading');
    setError(null);
    const r = await loadDeptWorkspace();
    if (!r.ok) {
      setState('error');
      setError(r.message);
      return;
    }
    setTree(r.tree);
    setFlat(r.flat);
    setState('ready');
  }, [canManage]);

  const loadGrantList = useCallback(async () => {
    if (!canManage) return;
    const gen = ++grantGen.current;
    const r = await loadGrants();
    if (gen !== grantGen.current) return;
    if (!r.ok) {
      setError(r.message);
      setGrantLoadError(true);
      return;
    }
    setGrantLoadError(false);
    setGrants(r.grants);
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadGrantList();
  }, [loadGrantList]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFlash(null);
    const r = await createDept({
      name,
      code: code || null,
      parentId: parentId || null,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setName('');
    setCode('');
    setParentId('');
    setFlash(`已创建 ${r.dept.name}`);
    await load();
  }

  async function onToggleStatus(d: Department) {
    if (busy) return;
    setBusy(true);
    setFlash(null);
    const next = d.status === 'active' ? 'disabled' : 'active';
    const r = await updateDept(d.id, { status: next });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFlash(`${d.name} → ${next}`);
    await load();
  }

  async function onDelete(d: Department) {
    if (busy) return;
    setBusy(true);
    setFlash(null);
    const r = await removeDept(d.id);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFlash(`已删除 ${d.name}`);
    await load();
  }

  async function onLoadAssign() {
    if (!canUser || !assignUserId || busy) return;
    setBusy(true);
    setError(null);
    const r = await loadUserDepts(assignUserId.trim());
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      setAssignView(null);
      return;
    }
    setAssignView(
      r.view.assignments.length === 0
        ? '（无归属）'
        : r.view.assignments
            .map(
              (a) =>
                `${a.deptName ?? a.deptId}${a.isPrimary ? '·主' : ''}${a.isLeader ? '·负责人' : ''}`,
            )
            .join('；'),
    );
  }

  async function onSaveAssign(e: FormEvent) {
    e.preventDefault();
    if (!canUser || !assignUserId || !assignDeptId || busy) return;
    setBusy(true);
    setFlash(null);
    const r = await saveUserDepts(assignUserId.trim(), {
      assignments: [
        {
          deptId: assignDeptId,
          isPrimary: assignPrimary,
          isLeader: assignLeader,
        },
      ],
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFlash('用户归属已保存');
    await onLoadAssign();
  }

  async function onCreateGrant(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFlash(null);
    setError(null);
    const r = await createGrant({
      userId: grantUserId.trim(),
      deptId: grantDeptId.trim(),
      maxVisibilityLevel: grantLevel,
      expiresAt: grantExpires.trim() === '' ? null : grantExpires.trim(),
      ...(grantReason.trim() ? { reason: grantReason.trim() } : {}),
    });
    if (!r.ok) {
      setBusy(false);
      setError(r.message);
      return;
    }
    setGrantUserId('');
    setGrantDeptId('');
    setGrantExpires('');
    setGrantReason('');
    setFlash('已创建授权');
    await loadGrantList();
    setBusy(false);
  }

  async function onDeleteGrant(id: string) {
    if (busy) return;
    setBusy(true);
    setFlash(null);
    setError(null);
    const r = await removeGrant(id);
    if (!r.ok) {
      setBusy(false);
      setError(r.message);
      return;
    }
    setFlash('已删除授权');
    await loadGrantList();
    setBusy(false);
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">部门</h1>
        <p className="mt-2 text-sm text-muted-foreground">403 · 无 dept.manage 权限</p>
      </div>
    );
  }

  const rows = flattenTree(tree);

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <header>
        <h1 className="text-lg font-semibold">部门</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          组织树 CRUD 与用户归属（壳）。跨部门授权表可配，检索是否消费另见开关。未开启检索部门强制（DEPT_ACL_ENFORCE）。
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      {flash && (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{flash}</p>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <h2 className="text-sm font-medium">新建部门</h2>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={onCreate}>
          <div className="space-y-1">
            <Label htmlFor="dept-name">名称</Label>
            <Input
              id="dept-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={200}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dept-code">编码（可选）</Label>
            <Input
              id="dept-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={64}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="dept-parent">上级部门（可选）</Label>
            <select
              id="dept-parent"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
            >
              <option value="">（根部门）</option>
              {flat
                .filter((d) => d.status === 'active')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !name.trim()}>
              创建
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">组织树</h2>
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void load()}>
            刷新
          </Button>
        </div>
        {state === 'loading' && <p className="text-sm text-muted-foreground">加载中…</p>}
        {state === 'ready' && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">暂无部门</p>
        )}
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              style={{ paddingLeft: `${12 + d.depth * 16}px` }}
            >
              <div>
                <span className="font-medium">{d.name}</span>
                {d.code && (
                  <span className="ml-2 text-xs text-muted-foreground">{d.code}</span>
                )}
                <span className="ml-2 text-xs text-muted-foreground">{d.status}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onToggleStatus(d)}
                >
                  {d.status === 'active' ? '禁用' : '启用'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void onDelete(d)}
                >
                  删除
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {canUser && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-medium">用户归属（需 user.manage）</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="assign-user">用户 ID</Label>
              <Input
                id="assign-user"
                value={assignUserId}
                onChange={(e) => setAssignUserId(e.target.value)}
                placeholder="uuid"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || !assignUserId.trim()}
                onClick={() => void onLoadAssign()}
              >
                查询归属
              </Button>
            </div>
          </div>
          {assignView && (
            <p className="text-sm text-muted-foreground">当前：{assignView}</p>
          )}
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSaveAssign}>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="assign-dept">设为所属部门（单条主归属，覆盖）</Label>
              <select
                id="assign-dept"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={assignDeptId}
                onChange={(e) => setAssignDeptId(e.target.value)}
              >
                <option value="">选择部门</option>
                {flat
                  .filter((d) => d.status === 'active')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assignPrimary}
                onChange={(e) => setAssignPrimary(e.target.checked)}
              />
              主部门
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={assignLeader}
                onChange={(e) => setAssignLeader(e.target.checked)}
              />
              负责人
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy || !assignUserId || !assignDeptId}>
                保存归属
              </Button>
            </div>
          </form>
        </section>
      )}

      <section className="space-y-3 rounded-lg border border-border p-4">
        <div>
          <h2 className="text-sm font-medium">跨部门授权</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            表可配，检索是否消费另见开关
          </p>
        </div>
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => void onCreateGrant(e)}>
          <div className="space-y-1">
            <Label htmlFor="grant-user">授权用户</Label>
            <Input
              id="grant-user"
              value={grantUserId}
              onChange={(e) => setGrantUserId(e.target.value)}
              placeholder="uuid"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="grant-dept">授权部门</Label>
            <select
              id="grant-dept"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={grantDeptId}
              onChange={(e) => setGrantDeptId(e.target.value)}
            >
              <option value="">选择部门</option>
              {flat
                .filter((d) => d.status === 'active')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="grant-level">可见级</Label>
            <select
              id="grant-level"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={grantLevel}
              onChange={(e) => setGrantLevel(Number(e.target.value) as VisibilityLevel)}
            >
              {VISIBILITY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="grant-expires">过期时间</Label>
            <Input
              id="grant-expires"
              value={grantExpires}
              onChange={(e) => setGrantExpires(e.target.value)}
              placeholder="yyyy-MM-dd HH:mm:ss"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="grant-reason">原因</Label>
            <Input
              id="grant-reason"
              value={grantReason}
              onChange={(e) => setGrantReason(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={busy || !grantUserId.trim() || !grantDeptId.trim()}>
              新建授权
            </Button>
          </div>
        </form>
        {grantLoadError ? (
          <p className="text-sm text-muted-foreground">授权列表加载失败</p>
        ) : grants.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无授权</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {grants.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0 break-all text-xs">
                  <div>userId {g.userId}</div>
                  <div>deptId {g.deptId}</div>
                  <div>level {g.maxVisibilityLevel}</div>
                  <div>expiresAt {g.expiresAt ?? '—'}</div>
                  <div>reason {g.reason ?? '—'}</div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  aria-label="删除授权"
                  onClick={() => void onDeleteGrant(g.id)}
                >
                  删除
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
