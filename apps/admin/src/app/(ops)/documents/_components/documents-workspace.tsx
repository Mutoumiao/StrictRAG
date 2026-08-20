'use client';

/**
 * 文档薄列表：status / approval / lifecycle / 向量 / 稀疏。
 * 点行展开详情；可改 ownerDeptId / visibilityLevel（有 doc.editor 才显示保存）。
 * 有 dept.manage 时归属用部门列表下拉；无该码仍 uuid 粘贴。不宣称强制隔离已上。
 * 表头上方按已加载行本地筛部门/可见级；不改 GET query。
 * 稀疏就绪是适配层/mock 标志，≠ 生产 ES。
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type {
  Department,
  DocumentDetail,
  DocumentListItem,
  VisibilityLevel,
} from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
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
  deptLabel,
  filterDocumentRows,
  loadDocumentList,
  readyColLabel,
  visibilityLabel,
} from '../list.services';
import {
  loadDepartmentOptions,
  loadDocumentDetail,
  saveDocumentMeta,
  type LoadDepartmentOptionsResult,
} from '../meta.services';

const VISIBILITY_LEVELS: VisibilityLevel[] = [10, 20, 30, 40];

function toVisibilityLevel(value: string): VisibilityLevel {
  const n = Number(value);
  return (VISIBILITY_LEVELS.includes(n as VisibilityLevel) ? n : 20) as VisibilityLevel;
}

export function DocumentsWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('doc.view');
  const canEdit = me.permissions.includes('doc.editor');
  const canManageDept = me.permissions.includes('dept.manage');
  const [rows, setRows] = useState<DocumentListItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetail | null>(null);
  const [detailState, setDetailState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [detailError, setDetailError] = useState<string | null>(null);
  const [filterOwnerDeptId, setFilterOwnerDeptId] = useState<'all' | 'lib' | string>('all');
  const [filterVisibilityLevel, setFilterVisibilityLevel] = useState<'all' | VisibilityLevel>(
    'all',
  );
  const [ownerDeptId, setOwnerDeptId] = useState('');
  const [visibilityLevel, setVisibilityLevel] = useState<VisibilityLevel>(20);
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [deptOptions, setDeptOptions] = useState<Department[] | null>(null);
  const [deptOptionsError, setDeptOptionsError] = useState<string | null>(null);
  const openIdRef = useRef<string | null>(null);
  const deptOptionsCache = useRef<Department[] | null>(null);
  const deptOptionsInflight = useRef<Promise<LoadDepartmentOptionsResult> | null>(null);

  async function ensureDeptOptions() {
    if (deptOptionsCache.current) return;
    if (!deptOptionsInflight.current) {
      deptOptionsInflight.current = loadDepartmentOptions();
    }
    const opts = await deptOptionsInflight.current;
    if (opts.ok) {
      deptOptionsCache.current = opts.departments;
      setDeptOptions(opts.departments);
      setDeptOptionsError(null);
      return;
    }
    deptOptionsInflight.current = null;
    setDeptOptionsError(opts.message);
  }

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
    const result = await loadDocumentList(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setRows(result.rows);
    setState('ready');
    if (canManageDept && result.rows.length > 0) void ensureDeptOptions();
  }, [canView, canManageDept]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  async function onOpenRow(docId: string) {
    if (openId === docId) {
      openIdRef.current = null;
      setOpenId(null);
      setDetail(null);
      setDetailState('idle');
      setDetailError(null);
      setSaveMessage(null);
      setBusy(false);
      return;
    }
    openIdRef.current = docId;
    setOpenId(docId);
    setDetail(null);
    setDetailError(null);
    setSaveMessage(null);
    setBusy(false);
    setDetailState('loading');
    const [result] = await Promise.all([
      loadDocumentDetail(docId),
      canManageDept ? ensureDeptOptions() : Promise.resolve(),
    ]);
    if (openIdRef.current !== docId) return;
    if (!result.ok) {
      setDetailState('error');
      setDetailError(result.message);
      return;
    }
    setDetail(result.detail);
    setOwnerDeptId(result.detail.ownerDeptId ?? '');
    setVisibilityLevel(result.detail.visibilityLevel ?? 20);
    setDetailState('ready');
  }

  async function onSave() {
    if (!openId) return;
    const docId = openId;
    setBusy(true);
    setSaveMessage(null);
    const result = await saveDocumentMeta(docId, {
      ownerDeptId: ownerDeptId.trim() === '' ? null : ownerDeptId.trim(),
      visibilityLevel,
    });
    if (openIdRef.current !== docId) {
      setBusy(false);
      return;
    }
    if (result.ok) {
      setDetail(result.detail);
      setOwnerDeptId(result.detail.ownerDeptId ?? '');
      setVisibilityLevel(result.detail.visibilityLevel ?? 20);
      setSaveMessage('已保存');
      setSaveOk(true);
    } else {
      setSaveMessage(result.message);
      setSaveOk(false);
    }
    setBusy(false);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">文档</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        稀疏就绪是适配层/mock 标志，≠ 生产 ES。
      </p>

      {!kbId ? (
        <p className="text-sm text-muted-foreground">请在顶栏填写知识库 UUID 后刷新。</p>
      ) : null}

      {state === 'loading' ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {state === 'error' ? <p className="text-sm text-destructive">{error}</p> : null}
      {state === 'ready' && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无文档</p>
      ) : null}

      {rows.length > 0 ? (
        <div>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="doc-filter-dept">部门</Label>
              <select
                id="doc-filter-dept"
                className="flex h-9 min-w-[8rem] rounded-md border border-input bg-card px-3 text-sm"
                value={filterOwnerDeptId}
                onChange={(e) => setFilterOwnerDeptId(e.target.value)}
              >
                <option value="all">全部</option>
                <option value="lib">库级</option>
                {deptOptions?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
                {filterOwnerDeptId !== 'all' &&
                filterOwnerDeptId !== 'lib' &&
                !deptOptions?.some((d) => d.id === filterOwnerDeptId) ? (
                  <option value={filterOwnerDeptId}>{filterOwnerDeptId}</option>
                ) : null}
              </select>
            </div>
            {canManageDept && deptOptionsError ? (
              <div className="space-y-1.5">
                <Label htmlFor="doc-filter-dept-uuid">部门 uuid</Label>
                <Input
                  id="doc-filter-dept-uuid"
                  value={
                    filterOwnerDeptId !== 'all' && filterOwnerDeptId !== 'lib'
                      ? filterOwnerDeptId
                      : ''
                  }
                  onChange={(e) => setFilterOwnerDeptId(e.target.value.trim() || 'all')}
                  placeholder="粘贴部门 uuid"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="doc-filter-visibility">可见级</Label>
              <select
                id="doc-filter-visibility"
                className="flex h-9 min-w-[6rem] rounded-md border border-input bg-card px-3 text-sm"
                value={filterVisibilityLevel}
                onChange={(e) => {
                  const v = e.target.value;
                  setFilterVisibilityLevel(v === 'all' ? 'all' : toVisibilityLevel(v));
                }}
              >
                <option value="all">全部</option>
                {VISIBILITY_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {visibilityLabel(level)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Table>
          <TableHeader>
            <TableRow className="border-b-border">
              <TableHead>标题</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>可见级</TableHead>
              <TableHead>status</TableHead>
              <TableHead>approval</TableHead>
              <TableHead>lifecycle</TableHead>
              <TableHead>向量</TableHead>
              <TableHead>稀疏</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filterDocumentRows(rows, {
              ownerDeptId: filterOwnerDeptId,
              visibilityLevel: filterVisibilityLevel,
            }).map((r) => (
              <Fragment key={r.id}>
                <TableRow
                  className={openId === r.id ? 'cursor-pointer bg-muted/40' : 'cursor-pointer'}
                  aria-expanded={openId === r.id}
                  tabIndex={0}
                  onClick={() => void onOpenRow(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      void onOpenRow(r.id);
                    }
                  }}
                >
                  <TableCell>
                    <div>{r.title}</div>
                    <div className="text-[11px] text-muted-foreground">{r.id}</div>
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-block max-w-[7rem] truncate align-bottom"
                      title={r.ownerDeptId ?? undefined}
                    >
                      {deptLabel(r.ownerDeptId, deptOptions)}
                    </span>
                  </TableCell>
                  <TableCell>{visibilityLabel(r.visibilityLevel)}</TableCell>
                  <TableCell>{r.status}</TableCell>
                  <TableCell>{r.approvalStatus}</TableCell>
                  <TableCell>{r.lifecycle}</TableCell>
                  <TableCell>{readyColLabel(r.embedReady)}</TableCell>
                  <TableCell>{readyColLabel(r.esReady)}</TableCell>
                </TableRow>
                {openId === r.id ? (
                  <TableRow>
                    <TableCell colSpan={8}>
                      {detailState === 'loading' ? (
                        <p className="text-sm text-muted-foreground">加载详情…</p>
                      ) : null}
                      {detailState === 'error' ? (
                        <p className="text-sm text-destructive">{detailError}</p>
                      ) : null}
                      {detailState === 'ready' && detail ? (
                        <div className="space-y-3 py-1">
                          <p className="text-xs text-muted-foreground">
                            空归属=库级。本页只改字段，不启用部门强制隔离。
                          </p>
                          <div className="grid max-w-md gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="doc-owner-dept">归属部门</Label>
                              {canManageDept && deptOptions ? (
                                <select
                                  id="doc-owner-dept"
                                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                  value={ownerDeptId}
                                  onChange={(e) => setOwnerDeptId(e.target.value)}
                                  disabled={!canEdit}
                                >
                                  <option value="">库级</option>
                                  {deptOptions.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.name}
                                    </option>
                                  ))}
                                  {ownerDeptId && !deptOptions.some((d) => d.id === ownerDeptId) ? (
                                    <option value={ownerDeptId}>{ownerDeptId}</option>
                                  ) : null}
                                </select>
                              ) : (
                                <Input
                                  id="doc-owner-dept"
                                  value={ownerDeptId}
                                  onChange={(e) => setOwnerDeptId(e.target.value)}
                                  placeholder="空=库级"
                                  disabled={!canEdit}
                                />
                              )}
                              {canManageDept && deptOptionsError ? (
                                <p className="text-sm text-destructive">{deptOptionsError}</p>
                              ) : null}
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="doc-visibility">可见级</Label>
                              <select
                                id="doc-visibility"
                                className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                value={visibilityLevel}
                                onChange={(e) => setVisibilityLevel(toVisibilityLevel(e.target.value))}
                                disabled={!canEdit}
                              >
                                {VISIBILITY_LEVELS.map((level) => (
                                  <option key={level} value={level}>
                                    {visibilityLabel(level)}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          {canEdit ? (
                            <Button type="button" size="sm" disabled={busy} onClick={() => void onSave()}>
                              {busy ? '保存中…' : '保存'}
                            </Button>
                          ) : null}
                          {saveMessage ? (
                            <p className={saveOk ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
                              {saveMessage}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            ))}
          </TableBody>
        </Table>
        </div>
      ) : null}
    </div>
  );
}
