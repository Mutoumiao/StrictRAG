'use client';

/**
 * 文档薄列表：类型 / 运营标签 / 向量 / 稀疏。
 * 点行展开详情；可改 ownerDeptId / visibilityLevel / docType / aclPrincipals / 生效区间（有 doc.editor 才显示保存）。
 * 有 dept.manage 时归属用部门列表下拉；无该码仍 uuid 粘贴。不宣称强制隔离已上。
 * Reindex 走 for-upload；≥2 必须人选。lifecycle 含归档/废止/删除（DELETE 入队 purge）。替代须选后继。上架仍须 ready。
 * 表头上方按已加载行本地筛部门/可见级；不改 GET query。
 * 创建面（上传 / 编写）可标新文档归属部门与可见级；有 dept.manage 才拉部门名。不宣称强制隔离已上。
 * 稀疏就绪是适配层/mock 标志，≠ 生产 ES。
 */

import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type {
  Department,
  DocumentDetail,
  DocumentListItem,
  ForUploadResponse,
  IngestJobListItem,
  IngestReportItem,
  Lifecycle,
  VisibilityLevel,
} from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { ClosedSelect } from '@strict-rag/ui/components/ui/closed-select';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { Textarea } from '@strict-rag/ui/components/ui/textarea';
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
  strategySnapshotLabel,
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
import { dedupeRateLabel, loadIngestReports, NO_INGEST_REPORT_HINT, reportsForDoc } from '../report.services';
import {
  canArchive,
  canPublish,
  canRevertDraft,
  canSubmitSupersede,
  canSupersede,
  deleteAdminDocument,
  eligibleSuccessorOptions,
  setDocumentLifecycle,
  supersedeAdminDocument,
} from '../lifecycle.services';
import {
  pickReindexChunkStrategy,
  planReindexChunkStrategy,
  reindexAdminDocument,
} from '../reindex.services';
import {
  pickUploadChunkStrategy,
  planUploadChunkStrategy,
  resolveUploadContentType,
  toCreateDocAclFields,
  uploadAdminDocument,
} from '../upload.services';
import {
  WRITE_MARKDOWN_TYPE,
  canSubmitWrite,
  pickWriteChunkStrategy,
  planWriteChunkStrategy,
  writeAdminDocument,
} from '../write.services';

const LIST_COL_COUNT = 7;

const VISIBILITY_LEVELS: VisibilityLevel[] = [10, 20, 30, 40];

function toVisibilityLevel(value: string): VisibilityLevel {
  const n = Number(value);
  return (VISIBILITY_LEVELS.includes(n as VisibilityLevel) ? n : 20) as VisibilityLevel;
}

function parsePrincipalsText(text: string): string[] {
  return text
    .split(/[,\n\r]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** 未勾选且空 → null；勾选且空 → []；有 UUID → 数组。 */
function aclPrincipalsFromForm(restrictToList: boolean, text: string): string[] | null {
  const ids = parsePrincipalsText(text);
  if (ids.length > 0) return ids;
  return restrictToList ? [] : null;
}

function principalsFormFromDetail(aclPrincipals: string[] | null | undefined): {
  restrictToList: boolean;
  text: string;
} {
  return {
    restrictToList: aclPrincipals != null,
    text: (aclPrincipals ?? []).join('\n'),
  };
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
  const [restrictToList, setRestrictToList] = useState(false);
  const [principalsText, setPrincipalsText] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');
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
  const [docReports, setDocReports] = useState<IngestReportItem[]>([]);
  const [reportNote, setReportNote] = useState<string | null>(null);
  const [reindexPlan, setReindexPlan] = useState<ForUploadResponse | null>(null);
  const [reindexPicked, setReindexPicked] = useState('');
  const [reindexBusy, setReindexBusy] = useState(false);
  const [reindexMessage, setReindexMessage] = useState<string | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeTitle, setWriteTitle] = useState('');
  const [writeMarkdown, setWriteMarkdown] = useState('');
  const [writeBusy, setWriteBusy] = useState(false);
  const [writeMessage, setWriteMessage] = useState<string | null>(null);
  const [writePlan, setWritePlan] = useState<ForUploadResponse | null>(null);
  const [writePicked, setWritePicked] = useState('');
  const [createOwnerDeptId, setCreateOwnerDeptId] = useState('');
  const [createVisibilityLevel, setCreateVisibilityLevel] = useState<VisibilityLevel>(20);
  const [successorId, setSuccessorId] = useState('');
  const writePlanKbRef = useRef('');
  const writePlanGen = useRef(0);
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
    if (writePlanKbRef.current && writePlanKbRef.current !== id) {
      writePlanGen.current += 1;
      writePlanKbRef.current = '';
      setWriteOpen(false);
      setWritePlan(null);
      setWritePicked('');
    }
    if (!id) {
      writePlanGen.current += 1;
      writePlanKbRef.current = '';
      setWriteOpen(false);
      setWritePlan(null);
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
    if (canManageDept) void ensureDeptOptions();
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
      setSuccessorId('');
      setDocReports([]);
      setReportNote(null);
      return;
    }
    openIdRef.current = docId;
    setOpenId(docId);
    setDetail(null);
    setDetailError(null);
    setSaveMessage(null);
    setBusy(false);
    setSuccessorId('');
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
    const principals = principalsFormFromDetail(result.detail.aclPrincipals);
    setRestrictToList(principals.restrictToList);
    setPrincipalsText(principals.text);
    setEffectiveFrom(result.detail.effectiveFrom ?? '');
    setEffectiveTo(result.detail.effectiveTo ?? '');
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
    const reportKbId = result.detail.kbId;
    const reportsResult = await loadIngestReports(reportKbId);
    if (openIdRef.current !== docId) return;
    if (reportsResult.ok) {
      const mine = reportsForDoc(reportsResult.reports, docId);
      setDocReports(mine);
      setReportNote(mine.length === 0 ? NO_INGEST_REPORT_HINT : null);
    } else {
      setDocReports([]);
      setReportNote(reportsResult.message);
    }
  }

  async function runUpload(file: File, chunkStrategy: string) {
    const id = readStoredKbId().trim();
    setUploadBusy(true);
    setUploadMessage(null);
    const result = await uploadAdminDocument(
      id,
      file,
      chunkStrategy,
      toCreateDocAclFields(createOwnerDeptId, createVisibilityLevel),
    );
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
    const media = resolveUploadContentType(file);
    if (!media.ok) {
      setUploadBusy(false);
      setUploadMessage(media.message);
      return;
    }
    const planned = await planUploadChunkStrategy(id, media.contentType);
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

  async function openWritePanel() {
    const id = readStoredKbId().trim();
    const gen = ++writePlanGen.current;
    writePlanKbRef.current = '';
    setWriteOpen(true);
    setWriteMessage(null);
    setWritePlan(null);
    setWritePicked('');
    if (!id) return;
    const planned = await planWriteChunkStrategy(id, WRITE_MARKDOWN_TYPE);
    if (gen !== writePlanGen.current) return;
    if (!planned.ok) {
      setWriteMessage(planned.message);
      return;
    }
    setWritePlan(planned.plan);
    writePlanKbRef.current = id;
    if (planned.plan.requireExplicit) {
      setWritePicked('');
    } else {
      const picked = pickWriteChunkStrategy(planned.plan);
      setWritePicked(picked.ok ? picked.code : '');
    }
  }

  async function onSubmitWrite() {
    const id = readStoredKbId().trim();
    if (!id || !canEdit) return;
    if (!canSubmitWrite(writeTitle, writeMarkdown)) {
      setWriteMessage('请填写标题和正文');
      return;
    }
    if (!writePlan || writePlanKbRef.current !== id) {
      setWriteMessage('分片策略未就绪');
      return;
    }
    const picked = pickWriteChunkStrategy(writePlan, writePicked);
    if (!picked.ok) {
      setWriteMessage(picked.message);
      return;
    }
    setWriteBusy(true);
    setWriteMessage(null);
    const result = await writeAdminDocument(
      id,
      writeTitle,
      writeMarkdown,
      picked.code,
      toCreateDocAclFields(createOwnerDeptId, createVisibilityLevel),
    );
    if (result.ok) {
      setWriteMessage('已提交审批');
      setWriteTitle('');
      setWriteMarkdown('');
      setWriteOpen(false);
      await load();
    } else {
      setWriteMessage(result.message);
    }
    setWriteBusy(false);
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

  async function onSupersede() {
    if (!openId || !canSubmitSupersede(successorId)) return;
    const docId = openId;
    const nextId = successorId;
    setBusy(true);
    setSaveMessage(null);
    const result = await supersedeAdminDocument(docId, nextId);
    if (openIdRef.current !== docId) {
      setBusy(false);
      return;
    }
    if (result.ok) {
      setDetail((d) =>
        d
          ? { ...d, lifecycle: 'superseded', supersededByDocId: nextId }
          : d,
      );
      setRows((rs) =>
        rs.map((r) => {
          if (r.id === docId) {
            return { ...r, lifecycle: 'superseded', supersededByDocId: nextId };
          }
          if (r.id === nextId) {
            return { ...r, lifecycle: 'active', supersedesDocId: docId };
          }
          return r;
        }),
      );
      setSuccessorId('');
      setSaveMessage('已替代为后继');
      setSaveOk(true);
    } else {
      setSaveMessage(result.message);
      setSaveOk(false);
    }
    setBusy(false);
  }

  async function onDelete() {
    if (!openId) return;
    const docId = openId;
    setBusy(true);
    setSaveMessage(null);
    const result = await deleteAdminDocument(docId);
    if (openIdRef.current !== docId) {
      setBusy(false);
      return;
    }
    if (result.ok) {
      setDetail((d) => (d ? { ...d, lifecycle: 'archived' } : d));
      setRows((rs) => rs.map((r) => (r.id === docId ? { ...r, lifecycle: 'archived' } : r)));
      setSaveMessage('已删除');
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
      aclPrincipals: aclPrincipalsFromForm(restrictToList, principalsText),
      effectiveFrom: effectiveFrom.trim() === '' ? null : effectiveFrom.trim(),
      effectiveTo: effectiveTo.trim() === '' ? null : effectiveTo.trim(),
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
      const principals = principalsFormFromDetail(result.detail.aclPrincipals);
      setRestrictToList(principals.restrictToList);
      setPrincipalsText(principals.text);
      setEffectiveFrom(result.detail.effectiveFrom ?? '');
      setEffectiveTo(result.detail.effectiveTo ?? '');
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
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={writeBusy || (!kbId && !writeOpen)}
              aria-expanded={writeOpen}
              aria-controls="write-panel"
              onClick={() => {
                if (writeOpen) {
                  writePlanGen.current += 1;
                  writePlanKbRef.current = '';
                  setWriteOpen(false);
                  setWritePlan(null);
                  return;
                }
                void openWritePanel();
              }}
            >
              在线编写
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            刷新
          </Button>
        </div>
      </div>
      {canUpload || canEdit ? (
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="create-owner-dept">新文档归属部门</Label>
            <ClosedSelect
              id="create-owner-dept"
              value={createOwnerDeptId}
              onValueChange={setCreateOwnerDeptId}
              disabled={uploadBusy || writeBusy}
              options={
                canManageDept && deptOptions
                  ? [
                      { value: '', label: '库级' },
                      ...deptOptions.map((d) => ({ value: d.id, label: d.name })),
                    ]
                  : [{ value: '', label: '库级' }]
              }
            />
            {canManageDept && deptOptionsError ? (
              <p className="text-sm text-destructive">{deptOptionsError}</p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="create-visibility">新文档可见级</Label>
            <ClosedSelect
              id="create-visibility"
              value={String(createVisibilityLevel)}
              onValueChange={(v) => setCreateVisibilityLevel(toVisibilityLevel(v))}
              disabled={uploadBusy || writeBusy}
              options={VISIBILITY_LEVELS.map((level) => ({
                value: String(level),
                label: visibilityLabel(level),
              }))}
            />
          </div>
        </div>
      ) : null}
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
      {writeMessage ? (
        <p
          className={
            writeMessage === '已提交审批'
              ? 'mb-2 text-sm text-muted-foreground'
              : 'mb-2 text-sm text-destructive'
          }
          aria-live="polite"
        >
          {writeMessage}
        </p>
      ) : null}
      {canEdit && writeOpen ? (
        <form
          id="write-panel"
          className="mb-4 flex max-w-xl flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void onSubmitWrite();
          }}
        >
          <Label htmlFor="write-title">编写标题</Label>
          <Input
            id="write-title"
            value={writeTitle}
            onChange={(e) => setWriteTitle(e.target.value)}
            disabled={writeBusy}
          />
          <Label htmlFor="write-markdown">编写正文</Label>
          <Textarea
            id="write-markdown"
            value={writeMarkdown}
            onChange={(e) => setWriteMarkdown(e.target.value)}
            disabled={writeBusy}
            rows={8}
          />
          {writePlan?.requireExplicit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor="write-chunk-strategy">分片策略</Label>
              <ClosedSelect
                id="write-chunk-strategy"
                value={writePicked}
                onValueChange={setWritePicked}
                disabled={writeBusy}
                options={writePlan.available.map((a) => ({
                  value: a.code,
                  label: a.recommended ? `${a.name}（recommended）` : a.name,
                }))}
              />
            </div>
          ) : null}
          <Button
            type="submit"
            size="sm"
            disabled={
              writeBusy ||
              !writePlan ||
              !canSubmitWrite(writeTitle, writeMarkdown) ||
              (writePlan.requireExplicit && !writePicked.trim())
            }
          >
            提交审批
          </Button>
        </form>
      ) : null}
      <p className="mb-4 text-xs text-muted-foreground">
        稀疏就绪是适配层/mock 标志，≠ 生产 ES。
      </p>

      {!kbId ? (
        <p className="text-sm text-muted-foreground">请在顶栏选择知识库</p>
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
                              <label className="flex items-center gap-2 text-sm">
                                <input
                                  id="doc-acl-restrict"
                                  type="checkbox"
                                  checked={restrictToList}
                                  onChange={(e) => setRestrictToList(e.target.checked)}
                                  disabled={!canEdit}
                                />
                                仅名单可见
                              </label>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="doc-acl-principals">可见用户 uuid</Label>
                              <Textarea
                                id="doc-acl-principals"
                                value={principalsText}
                                onChange={(e) => setPrincipalsText(e.target.value)}
                                placeholder="逗号或换行分隔用户 uuid"
                                disabled={!canEdit}
                              />
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
                            <div className="space-y-1.5">
                              <Label htmlFor="doc-effective-from">生效自</Label>
                              <Input
                                id="doc-effective-from"
                                value={effectiveFrom}
                                onChange={(e) => setEffectiveFrom(e.target.value)}
                                placeholder="yyyy-MM-dd HH:mm:ss，空=不限"
                                disabled={!canEdit}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="doc-effective-to">生效至</Label>
                              <Input
                                id="doc-effective-to"
                                value={effectiveTo}
                                onChange={(e) => setEffectiveTo(e.target.value)}
                                placeholder="yyyy-MM-dd HH:mm:ss，空=不限"
                                disabled={!canEdit}
                              />
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
                          {canLifecycle && canSupersede(detail.lifecycle) ? (
                            <div className="space-y-2">
                              <Label htmlFor="doc-successor">后继文档</Label>
                              <ClosedSelect
                                id="doc-successor"
                                value={successorId}
                                onValueChange={setSuccessorId}
                                disabled={busy}
                                placeholder="请选择后继文档"
                                options={eligibleSuccessorOptions(rows, detail.id)}
                              />
                              <Button
                                type="button"
                                size="sm"
                                disabled={busy || !canSubmitSupersede(successorId)}
                                onClick={() => void onSupersede()}
                              >
                                替代为后继
                              </Button>
                            </div>
                          ) : null}
                          {canLifecycle ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void onDelete()}
                            >
                              删除
                            </Button>
                          ) : null}
                          <p className="text-xs text-muted-foreground">检索闸仍 ready∧active，不自动升。删除会归档并清索引与对象。</p>
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
                          <div className="text-xs">
                            <p className="font-semibold">入库报告</p>
                            {reportNote ? <p className="text-muted-foreground">{reportNote}</p> : null}
                            {docReports.length > 0 ? (
                              <ul className="m-0 list-disc ps-4">
                                {docReports.map((r) => (
                                  <li key={r.id}>
                                    v{r.indexVersion} · 分片 {r.chunkCount} · 文档内去重{' '}
                                    {r.internalDropped} · 跨文档去重 {r.crossDocDropped} · 跨文档去重率{' '}
                                    {dedupeRateLabel(r.dedupeCrossDocRate)}
                                    {r.contextSource ? ` · 情境 ${r.contextSource}` : ''}
                                    {r.conflictPairs.length > 0
                                      ? ` · 冲突 ${r.conflictPairs.map((p) => p.otherDocId).join(', ')}`
                                      : ''}
                                    {r.dualReady ? ' · 双就绪' : ' · 未双就绪'}
                                    {r.reconcile
                                      ? ` · 对账${r.reconcile.ok ? '通过' : '失败'} missing ${r.reconcile.missingCount} orphan ${r.reconcile.orphanCount}`
                                      : ''}
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          <div className="text-xs">
                            <p className="font-semibold">分片策略（历史，只读）</p>
                            <p className="text-muted-foreground">
                              {strategySnapshotLabel(
                                detail?.chunkStrategy,
                                detail?.chunkStrategyParams,
                              )}
                            </p>
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
