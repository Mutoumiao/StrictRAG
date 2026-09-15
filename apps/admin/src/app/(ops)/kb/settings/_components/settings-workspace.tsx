'use client';

/**
 * 知识库设置薄页：基本信息 / 文档类型分区 / 语料分级 / 部门强制 / 部门继承 / 问答档位 / KB 消费绑定 / 质量只读 / rewrite 锁 / 修改日志。
 * 禁止 τ 滑块与 rewrite 开关。sensitive complete 须 ACL 就绪。强制勾选 ≠ 仓库默认开。
 * 未改 inherit 勾选不得 PATCH deptInheritDown（GET 缺省 true 不可写回盖 env）。
 * 未改强制勾选不得 PATCH deptAclEnforce（GET 缺省 false 不可写回钉成显式关）。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type {
  AskMode,
  DataClass,
  KbConsumePurpose,
  KbSettings,
  KbSettingsAuditItem,
  ModelCatalogItem,
} from '@strict-rag/contracts';
import { KB_CONSUME_PURPOSES } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { ClosedSelect } from '@strict-rag/ui/components/ui/closed-select';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId } from '@/lib/kb-context';

import {
  catalogOptionsForPurpose,
  catalogsEqual,
  draftsFromKbBindings,
  draftsFromSettings,
  draftsToCatalog,
  draftsToKbConsumeBindings,
  emptyKbConsumeDrafts,
  formatSettingsAuditValue,
  kbConsumeDraftsEqual,
  loadKbBindings,
  loadKbSettings,
  loadKbSettingsAudit,
  loadModelCatalog,
  NO_SETTINGS_AUDIT_HINT,
  saveKbBindings,
  saveKbSettings,
  type DocTypeDraft,
  type KbConsumeDrafts,
} from '../services';

const CONSUME_PURPOSE_LABEL: Record<KbConsumePurpose, string> = {
  generate: '生成',
  embed: '向量',
  rerank: '重排',
};
import { ChunkStrategyPanel } from './chunk-strategy-panel';

const ALL_MODES: AskMode[] = ['strict', 'balanced', 'fast'];
const DATA_CLASSES: DataClass[] = ['internal', 'sensitive'];

export function SettingsWorkspace() {
  const { me } = useAdminAuth();
  const canWrite = me.permissions.includes('kb.config.write');

  const [kbId, setKbId] = useState('');
  const [settings, setSettings] = useState<KbSettings | null>(null);
  const [auditItems, setAuditItems] = useState<KbSettingsAuditItem[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowedModes, setAllowedModes] = useState<AskMode[]>(['balanced']);
  const [defaultMode, setDefaultMode] = useState<AskMode>('balanced');
  const [dataClass, setDataClass] = useState<DataClass>('internal');
  const [deptInheritDown, setDeptInheritDown] = useState(true);
  const [deptAclEnforce, setDeptAclEnforce] = useState(false);
  const [docTypeDrafts, setDocTypeDrafts] = useState<DocTypeDraft[]>([]);
  const [consumeDrafts, setConsumeDrafts] = useState<KbConsumeDrafts>(emptyKbConsumeDrafts);
  const [loadedConsumeDrafts, setLoadedConsumeDrafts] = useState<KbConsumeDrafts>(emptyKbConsumeDrafts);
  const [modelCatalog, setModelCatalog] = useState<ModelCatalogItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const applySettings = useCallback((s: KbSettings) => {
    setSettings(s);
    setName(s.name);
    setDescription(s.description ?? '');
    setAllowedModes(s.allowedModes);
    setDefaultMode(s.defaultMode);
    setDataClass(s.dataClass ?? 'internal');
    setDeptInheritDown(s.deptInheritDown ?? true);
    setDeptAclEnforce(s.deptAclEnforce ?? false);
    setDocTypeDrafts(draftsFromSettings(s));
  }, []);

  const load = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setSettings(null);
      setAuditItems([]);
      setState('idle');
      setError(null);
      return;
    }
    if (!canWrite) {
      setState('error');
      setError('无 kb.config.write 权限');
      return;
    }
    setState('loading');
    setError(null);
    const result = await loadKbSettings(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    applySettings(result.settings);
    const audits = await loadKbSettingsAudit(id);
    setAuditItems(audits.ok ? audits.items : []);
    const binds = await loadKbBindings(id);
    if (binds.ok) {
      const drafts = draftsFromKbBindings(binds.bindings);
      setConsumeDrafts(drafts);
      setLoadedConsumeDrafts(drafts);
    } else {
      setConsumeDrafts(emptyKbConsumeDrafts());
      setLoadedConsumeDrafts(emptyKbConsumeDrafts());
    }
    const catalog = await loadModelCatalog();
    setModelCatalog(catalog.items);
    setState('ready');
  }, [canWrite, applySettings]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleMode(mode: AskMode) {
    setAllowedModes((prev) => {
      if (prev.includes(mode)) {
        if (prev.length === 1) return prev;
        const next = prev.filter((m) => m !== mode);
        if (!next.includes(defaultMode)) {
          setDefaultMode(next[0]!);
        }
        return next;
      }
      return [...prev, mode];
    });
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    const id = readStoredKbId().trim();
    if (!id || !name.trim()) return;
    setBusy(true);
    setFlash(null);
    const loadedInherit = settings?.deptInheritDown ?? true;
    const loadedEnforce = settings?.deptAclEnforce ?? false;
    const loadedCatalog = settings ? draftsToCatalog(draftsFromSettings(settings)) : [];
    const nextCatalog = draftsToCatalog(docTypeDrafts);
    const result = await saveKbSettings(id, {
      name: name.trim(),
      description: description.trim() || null,
      allowedModes,
      defaultMode,
      dataClass,
      ...(catalogsEqual(nextCatalog, loadedCatalog) ? {} : { docTypeItems: nextCatalog }),
      ...(deptInheritDown !== loadedInherit ? { deptInheritDown } : {}),
      ...(deptAclEnforce !== loadedEnforce ? { deptAclEnforce } : {}),
    });
    if (result.ok && !kbConsumeDraftsEqual(consumeDrafts, loadedConsumeDrafts)) {
      const bindRes = await saveKbBindings(id, draftsToKbConsumeBindings(consumeDrafts));
      if (!bindRes.ok) {
        setFlash(bindRes.message);
        setBusy(false);
        return;
      }
      setLoadedConsumeDrafts({ ...consumeDrafts });
    }
    if (result.ok) {
      applySettings(result.settings);
      setFlash(result.text);
      setState('ready');
      const audits = await loadKbSettingsAudit(id);
      setAuditItems(audits.ok ? audits.items : []);
    } else {
      setFlash(result.message);
    }
    setBusy(false);
  }

  if (!canWrite) {
    return (
      <div>
        <h1 className="mb-3 text-lg font-semibold">知识库设置</h1>
        <p className="text-sm text-destructive">无 kb.config.write 权限（403）</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-lg font-semibold">知识库设置</h1>
        <p className="text-xs text-muted-foreground">
          KB：{kbId || '（请在顶栏选择知识库）'}
        </p>
      </div>

      {state === 'loading' && <p className="text-sm text-muted-foreground">加载中…</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {flash && (
        <p
          className={
            flash === '已保存' || flash.startsWith('已保存')
              ? 'text-sm text-muted-foreground'
              : 'text-sm text-destructive'
          }
        >
          {flash}
        </p>
      )}

      {settings && (
        <form onSubmit={onSave} className="space-y-6">
          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">基本信息</h2>
            <div className="space-y-2">
              <Label htmlFor="kb-name">名称</Label>
              <Input
                id="kb-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-desc">描述</Label>
              <Input
                id="kb-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={2000}
              />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">语料分级</h2>
            <div className="space-y-2">
              <Label htmlFor="kb-data-class">语料分级</Label>
              <select
                id="kb-data-class"
                className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
                value={dataClass}
                onChange={(e) => setDataClass(e.target.value as DataClass)}
              >
                {DATA_CLASSES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">
              sensitive complete 须 ACL 就绪：本库部门强制且文档有归属部门，或文档已设显式名单（含空名单）。这是
              complete 解禁条件，不等于仓库默认打开部门强制，也不是角色 principal。
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">部门强制</h2>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={deptAclEnforce}
                onChange={(e) => setDeptAclEnforce(e.target.checked)}
              />
              本库打开部门强制
            </label>
            <p className="text-xs text-muted-foreground">
              勾选后本库打开强制，走部门可见性过滤（覆盖进程 env）。不是仓库默认开，不是解禁，不是
              ES 已对称。
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">部门继承</h2>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={deptInheritDown}
                onChange={(e) => setDeptInheritDown(e.target.checked)}
              />
              上级看下级
            </label>
            <p className="text-xs text-muted-foreground">
              只在本库或进程打开部门强制时生效，不是打开强制隔离。
            </p>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">问答档位</h2>
            <div className="flex flex-wrap gap-3">
              {ALL_MODES.map((m) => (
                <label key={m} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={allowedModes.includes(m)}
                    onChange={() => toggleMode(m)}
                  />
                  {m}
                </label>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="kb-default-mode">默认档位</Label>
              <select
                id="kb-default-mode"
                className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
                value={defaultMode}
                onChange={(e) => setDefaultMode(e.target.value as AskMode)}
              >
                {allowedModes.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">文档类型</h2>
            <p className="text-xs text-muted-foreground">
              逐条维护码、显示名、排序与启用。停用不出成员枚举、不能新标。空列表 = 不限制 ask
              scope，文档只能清类型。
            </p>
            <ul className="space-y-2">
              {docTypeDrafts.map((row, index) => (
                <li
                  key={`doc-type-${index}`}
                  className="flex flex-wrap items-end gap-2 rounded-md border border-border p-2"
                >
                  <div className="space-y-1">
                    <Label htmlFor={`doc-type-code-${index}`}>码</Label>
                    <Input
                      id={`doc-type-code-${index}`}
                      value={row.code}
                      onChange={(e) =>
                        setDocTypeDrafts((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, code: e.target.value } : item,
                          ),
                        )
                      }
                      maxLength={64}
                    />
                  </div>
                  <div className="min-w-[8rem] flex-1 space-y-1">
                    <Label htmlFor={`doc-type-label-${index}`}>显示名</Label>
                    <Input
                      id={`doc-type-label-${index}`}
                      value={row.label}
                      onChange={(e) =>
                        setDocTypeDrafts((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, label: e.target.value } : item,
                          ),
                        )
                      }
                      maxLength={128}
                    />
                  </div>
                  <label className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={row.enabled}
                      onChange={(e) =>
                        setDocTypeDrafts((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, enabled: e.target.checked } : item,
                          ),
                        )
                      }
                    />
                    启用
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === 0}
                    onClick={() =>
                      setDocTypeDrafts((prev) => {
                        if (index === 0) return prev;
                        const next = prev.slice();
                        const cur = next[index]!;
                        next[index] = next[index - 1]!;
                        next[index - 1] = cur;
                        return next;
                      })
                    }
                  >
                    上移
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={index === docTypeDrafts.length - 1}
                    onClick={() =>
                      setDocTypeDrafts((prev) => {
                        if (index >= prev.length - 1) return prev;
                        const next = prev.slice();
                        const cur = next[index]!;
                        next[index] = next[index + 1]!;
                        next[index + 1] = cur;
                        return next;
                      })
                    }
                  >
                    下移
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setDocTypeDrafts((prev) => prev.filter((_, i) => i !== index))
                    }
                  >
                    删除
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setDocTypeDrafts((prev) => [...prev, { code: '', label: '', enabled: true }])
              }
            >
              新增类型
            </Button>
          </section>

          <ChunkStrategyPanel kbId={kbId} canWrite={canWrite} />

          <section className="space-y-3 rounded-lg border border-border p-4">
            <h2 className="text-sm font-semibold">KB 消费绑定</h2>
            <p className="text-xs text-muted-foreground">
              仅 generate / embed / rerank。跟随平台则不写本库行。禁止改 judge。密钥不在本页。
            </p>
            {KB_CONSUME_PURPOSES.map((purpose) => (
              <div key={purpose} className="space-y-1.5">
                <Label htmlFor={`kb-bind-${purpose}`}>{CONSUME_PURPOSE_LABEL[purpose]}</Label>
                <ClosedSelect
                  id={`kb-bind-${purpose}`}
                  value={consumeDrafts[purpose]}
                  onValueChange={(value) =>
                    setConsumeDrafts((prev) => ({ ...prev, [purpose]: value }))
                  }
                  options={catalogOptionsForPurpose(
                    purpose,
                    modelCatalog,
                    consumeDrafts[purpose],
                  )}
                />
              </div>
            ))}
          </section>

          <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="text-sm font-semibold">质量（只读）</h2>
            <p className="text-xs text-muted-foreground">本页禁止改 τ / 门禁门槛（ADR-054）</p>
            <dl className="grid gap-1 text-sm">
              <div className="flex gap-2">
                <dt className="text-muted-foreground">tauClaim</dt>
                <dd className="font-mono">{settings.qualitySnapshot.tauClaim}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-muted-foreground">gatePackageId</dt>
                <dd className="font-mono">
                  {settings.qualitySnapshot.gatePackageId ?? '—'}
                </dd>
              </div>
            </dl>
          </section>

          <section className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
            <h2 className="text-sm font-semibold">会话 rewrite（锁）</h2>
            <p className="text-sm">
              默认开启：
              <span className="ml-1 font-mono">
                {String(settings.sessionRewrite.enabledDefault)}
              </span>
              <span className="ml-2 text-muted-foreground">
                （locked={String(settings.sessionRewrite.locked)} · P2 不可误开）
              </span>
            </p>
          </section>

          <Button type="submit" disabled={busy || !kbId}>
            {busy ? '保存中…' : '保存'}
          </Button>
        </form>
      )}

      {settings && (
        <section className="space-y-3 rounded-lg border border-border p-4">
          <h2 className="text-sm font-semibold">修改日志</h2>
          {auditItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">{NO_SETTINGS_AUDIT_HINT}</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {auditItems.map((row) => (
                <li key={row.id} className="space-y-1">
                  <p className="text-muted-foreground">
                    {row.createdAt ?? '—'} · {row.actorUserId}
                  </p>
                  <ul className="m-0 list-disc ps-4">
                    {Object.entries(row.diff).map(([field, change]) => (
                      <li key={field}>
                        {field}：{formatSettingsAuditValue(change.from)} →{' '}
                        {formatSettingsAuditValue(change.to)}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {!settings && state === 'idle' && !kbId && (
        <p className="text-sm text-muted-foreground">请在顶栏选择知识库</p>
      )}
    </div>
  );
}
