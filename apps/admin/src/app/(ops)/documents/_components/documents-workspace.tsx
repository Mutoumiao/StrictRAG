'use client';

/**
 * 文档薄列表：类型 / 运营标签 / 向量 / 稀疏。
 * 点行展开详情；可改 ownerDeptId / visibilityLevel / docType（有 doc.editor 才显示保存）。
 * 有 dept.manage 时归属用部门列表下拉；无该码仍 uuid 粘贴。不宣称强制隔离已上。
 * Reindex 走 for-upload；≥2 必须人选。lifecycle 含归档/废止。上架仍须 ready。
 * 表头上方按已加载行本地筛部门/可见级；不改 GET query。
 * 稀疏就绪是适配层/mock 标志，≠ 生产 ES。
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type {
  Department,
  DocumentDetail,
  DocumentListItem,
  ForUploadResponse,
  IngestJobListItem,
  Lifecycle,
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
  opsLabel,
  readyColLabel,
  visibilityLabel,
} from '../list.services';
import {
  loadDepartmentOptions,
  loadDocumentDetail,
  loadKbDocTypes,
  saveDocumentMeta,
  type LoadDepartmentOptionsResult,
} from '../meta.services';
import { loadIngestJobs } from '../jobs.services';
import {
  canArchive,
  canPublish,
  canRevertDraft,
  canSupersede,
  setDocumentLifecycle,
} from '../lifecycle.services';
import {
  pickReindexChunkStrategy,
  planReindexChunkStrategy,
  reindexAdminDocument,
} from '../reindex.services';
import { pickUploadChunkStrategy, planUploadChunkStrategy, uploadAdminDocument } from '../upload.services';

const LIST_COL_COUNT = 7;

const VISIBILITY_LEVELS: VisibilityLevel[] = [10, 20, 30, 40];

function toVisibilityLevel(value: string): VisibilityLevel {
  const n = Number(value);
  return (VISIBILITY_LEVELS.includes(n as VisibilityLevel) ? n : 20) as VisibilityLevel;
}

export function DocumentsWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('doc.view');
  const canEdit = me.permissions.includes('doc.editor');
  const canUpload = me.permissions.includes('doc.upload');
  const canLifecycle = me.permissions.includes('doc.lifecycle');
  const canReindex = me.permissions.includes('doc.reindex');
  const canManageDept = me.permissions.includes('dept.manage');
  const canReadKbTypes = me.permissions.includes('kb.config.write');
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
  const [docType, setDocType] = useState('');
  const [kbDocTypes, setKbDocTypes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [deptOptions, setDeptOptions] = useState<Department[] | null>(null);
  const [deptOptionsError, setDeptOptionsError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadPlan, setUploadPlan] = useState<ForUploadResponse | null>(null);
  const [pickedStrategy, setPickedStrategy] = useState('');
  const [jobs, setJobs] = useState<IngestJobListItem[]>([]);
  const [jobsNote, setJobsNote] = useState<string | null>(null);
  const [reindexPlan, setReindexPlan] = useState<ForUploadResponse | null>(null);
  const [reindexPicked, setReindexPicked] = useState('');
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);
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
    setDocType(result.detail.docType ?? '');
    setDetailState('ready');
    setReindexPlan(null);
    setReindexPicked('');
    setReindexMessage(null);
    if (canReadKbTypes) {
      const types = await loadKbDocTypes(result.detail.kbId);
      if (openIdRef.current !== docId) return;
      setKbDocTypes(types.ok ? types.docTypes : null);
    } else {
      setKbDocTypes(null);
    }
    if (canReindex) {
      const planned = await planReindexChunkStrategy(
        result.detail.kbId,
        result.detail.contentType ?? 'application/octet-stream',
      );
      if (openIdRef.current !== docId) return;
      if (planned.ok) {
        setReindexPlan(planned.plan);
        setReindexPicked(
          planned.plan.requireExplicit
            ? ''
            : (planned.plan.autoCode ?? planned.plan.recommendedCode ?? ''),
        );
      } else {
        setReindexMessage(planned.message);
      }
    }
    const jobsResult = await loadIngestJobs(docId);
    if (openIdRef.current !== docId) return;
    if (jobsResult.ok) {
      setJobs(jobsResult.jobs);
      setJobsNote(jobsResult.jobs.length === 0 ? '无入库阶段记录' : null);
    } else {
      setJobs([]);
      setJobsNote(jobsResult.message);
    }
  }

  async function runUpload(file: File, chunkStrategy: string) {
    const id = readStoredKbId().trim();
    setUploadBusy(true);
    setUploadMessage(null);
    const result = await uploadAdminDocument(id, file, chunkStrategy);
    if (result.ok) {
      setUploadMessage('已上传，待审批');
      setPendingFile(null);
      setUploadPlan(null);
      await load();
    } else {
      setUploadMessage(result.message);
    }
    setUploadBusy(false);
  }

  async function onPickFile(file: File | undefined) {
    const id = readStoredKbId().trim();
    if (!file || !id || !canUpload) return;
    setUploadBusy(true);
    setUploadMessage(null);
    const contentType = file.type || 'text/plain';
    const planned = await planUploadChunkStrategy(id, contentType);
    if (!planned.ok) {
      setUploadBusy(false);
      setUploadMessage(planned.message);
      return;
    }
    const picked = pickUploadChunkStrategy(planned.plan);
    if (planned.plan.requireExplicit) {
      setPendingFile(file);
      setUploadPlan(planned.plan);
      setPickedStrategy(picked.ok ? picked.code : (planned.plan.recommendedCode ?? ''));
      setUploadBusy(false);
      return;
    }
    if (!picked.ok) {
      setUploadBusy(false);
      setUploadMessage(picked.message);
      return;
    }
    await runUpload(file, picked.code);
  }

  async function onConfirmUpload() {
    if (!pendingFile || !uploadPlan) return;
    const picked = pickUploadChunkStrategy(uploadPlan, pickedStrategy);
    if (!picked.ok) {
      setUploadMessage(picked.message);
      return;
    }
    await runUpload(pendingFile, picked.code);
  }

  function lifecycleSavedMessage(lifecycle: Lifecycle): string {
    if (lifecycle === 'active') return '已上架';
    if (lifecycle === 'draft') return '已撤回 draft';
    if (lifecycle === 'archived') return '已归档';
    return '已废止';
  }

  async function onLifecycle(lifecycle: Lifecycle) {
    if (!openId) return;
    const docId = openId;
    setBusy(true);
    setSaveMessage(null);
    const result = await setDocumentLifecycle(docId, lifecycle);
    if (openIdRef.current !== docId) {
      setBusy(false);
      return;
    }
    if (result.ok) {
      setDetail((d) => (d ? { ...d, lifecycle: result.lifecycle } : d));
      setRows((rs) => rs.map((r) => (r.id === docId ? { ...r, lifecycle: result.lifecycle } : r)));
      setSaveMessage(lifecycleSavedMessage(lifecycle));
      setSaveOk(true);
    } else {
      setSaveMessage(result.message);
      setSaveOk(false);
    }
    setBusy(false);
  }

  async function onReindex() {
    if (!openId || !reindexPlan) return;
    const picked = pickReindexChunkStrategy(reindexPlan, reindexPicked);
    if (!picked.ok) {
      setReindexMessage(picked.message);
      return;
    }
    const docId = openId;
    setReindexBusy(true);
    setReindexMessage(null);
    const result = await reindexAdminDocument(docId, picked.code);
    if (openIdRef.current !== docId) {
      setReindexBusy(false);
      return;
    }
    if (result.ok) {
      setReindexMessage('已入队 reindex');
      await load();
    } else {
      setReindexMessage(result.message);
    }
    setReindexBusy(false);
  }

  async function onSave() {
    if (!openId) return;
    const docId = openId;
    setBusy(true);
    setSaveMessage(null);
    const result = await saveDocumentMeta(docId, {
      ownerDeptId: ownerDeptId.trim() === '' ? null : ownerDeptId.trim(),
      visibilityLevel,
      docType: docType.trim() === '' ? null : docType.trim(),
    });
    if (openIdRef.current !== docId) {
      setBusy(false);
      return;
    }
    if (result.ok) {
      setDetail(result.detail);
      setOwnerDeptId(result.detail.ownerDeptId ?? '');
      setVisibilityLevel(result.detail.visibilityLevel ?? 20);
      setDocType(result.detail.docType ?? '');
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
        <div className="flex items-center gap-2">
          {canUpload ? (
            <label className="text-sm">
              <span className="sr-only">上传文档</span>
              <input
                type="file"
                className="text-xs"
                disabled={uploadBusy || !kbId}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  void onPickFile(f);
                }}
              />
            </label>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </div>
      {uploadMessage ? <p className="mb-2 text-sm text-muted-foreground">{uploadMessage}</p> : null}
      {pendingFile && uploadPlan ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="upload-chunk-strategy">分片策略</Label>
          <select
            id="upload-chunk-strategy"
            className="flex h-9 rounded-md border border-input bg-card px-3 text-sm"
            value={pickedStrategy}
            onChange={(e) => setPickedStrategy(e.target.value)}
            disabled={uploadBusy}
          >
            {uploadPlan.available.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
                {a.recommended ? '（recommended）' : ''}
              </option>
            ))}
          </select>
          <Button type="button" size="sm" disabled={uploadBusy} onClick={() => void onConfirmUpload()}>
            确认上传
          </Button>
        </div>
      ) : null}
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
              <TableHead>类型</TableHead>
              <TableHead>运营</TableHead>
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
                  <TableCell>{r.docType ?? '未分类'}</TableCell>
                  <TableCell>
                    <div>{opsLabel(r.status, r.lifecycle, r.approvalStatus)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {r.status} · {r.lifecycle}
                    </div>
                  </TableCell>
                  <TableCell>{readyColLabel(r.embedReady)}</TableCell>
                  <TableCell>{readyColLabel(r.esReady)}</TableCell>
                </TableRow>
                {openId === r.id ? (
                  <TableRow>
                    <TableCell colSpan={LIST_COL_COUNT}>
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
                            <div className="space-y-1.5">
                              <Label htmlFor="doc-type">类型</Label>
                              {kbDocTypes ? (
                                <select
                                  id="doc-type"
                                  className="flex h-9 w-full rounded-md border border-input bg-card px-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                                  value={docType}
                                  onChange={(e) => setDocType(e.target.value)}
                                  disabled={!canEdit}
                                >
                                  <option value="">未分类</option>
                                  {kbDocTypes.map((code) => (
                                    <option key={code} value={code}>
                                      {code}
                                    </option>
                                  ))}
                                  {docType && !kbDocTypes.includes(docType) ? (
                                    <option value={docType}>{docType}</option>
                                  ) : null}
                                </select>
                              ) : (
                                <Input
                                  id="doc-type"
                                  value={docType}
                                  onChange={(e) => setDocType(e.target.value)}
                                  placeholder="须属于本库枚举"
                                  disabled={!canEdit}
                                />
                              )}
                            </div>
                          </div>
                          {canLifecycle ? (
                            <div className="flex flex-wrap gap-2">
                              {canPublish(detail.status, detail.lifecycle) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void onLifecycle('active')}
                                >
                                  上架 active
                                </Button>
                              ) : null}
                              {canRevertDraft(detail.lifecycle) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void onLifecycle('draft')}
                                >
                                  撤回 draft
                                </Button>
                              ) : null}
                              {canSupersede(detail.lifecycle) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void onLifecycle('superseded')}
                                >
                                  废止 superseded
                                </Button>
                              ) : null}
                              {canArchive(detail.lifecycle) ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void onLifecycle('archived')}
                                >
                                  归档 archived
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                          <p className="text-xs text-muted-foreground">检索闸仍 ready∧active，不自动升。</p>
                          {canReindex ? (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold">Reindex</p>
                              {reindexPlan?.requireExplicit ? (
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <Label htmlFor="reindex-chunk-strategy">分片策略</Label>
                                  <select
                                    id="reindex-chunk-strategy"
                                    className="flex h-9 rounded-md border border-input bg-card px-3 text-sm"
                                    value={reindexPicked}
                                    onChange={(e) => setReindexPicked(e.target.value)}
                                    disabled={reindexBusy}
                                  >
                                    <option value="">请选择</option>
                                    {reindexPlan.available.map((a) => (
                                      <option key={a.code} value={a.code}>
                                        {a.name}
                                        {a.recommended ? '（recommended）' : ''}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : null}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={
                                  reindexBusy ||
                                  !reindexPlan ||
                                  (reindexPlan.requireExplicit && !reindexPicked.trim())
                                }
                                onClick={() => void onReindex()}
                              >
                                {reindexBusy ? '入队中…' : 'Reindex'}
                              </Button>
                              {reindexMessage ? (
                                <p className="text-xs text-muted-foreground">{reindexMessage}</p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="text-xs">
                            <p className="font-semibold">入库阶段</p>
                            {jobsNote ? <p className="text-muted-foreground">{jobsNote}</p> : null}
                            {jobs.length > 0 ? (
                              <ul className="m-0 list-disc ps-4">
                                {jobs.map((j) => (
                                  <li key={j.id}>
                                    {j.jobName} · {j.status}
                                    {j.errorMessage ? ` · ${j.errorMessage}` : ''}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
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
