'use client';

/**
 * 模型网关薄页：供应商列表/表单 + 平台 purpose 绑定。
 * Key 仅密码框；永不展示明文。
 */

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import type {
  BindingPurpose,
  ModelCatalogItem,
  ModelItem,
  ModelPresetKey,
  ModelProvider,
  ModelProviderPreset,
  ModelType,
  PlatformBindings,
} from '@strict-rag/contracts';
import { PLATFORM_BINDING_PURPOSES } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';

import {
  createProvider,
  loadModelGateway,
  removeProvider,
  saveBindings,
  updateProvider,
} from '../services';

const MODEL_TYPES: ModelType[] = ['llm', 'embedding', 'rerank'];

type DraftModel = {
  name: string;
  type: ModelType;
  enabled: boolean;
  dimensions: string;
};

function emptyDraft(): {
  name: string;
  presetKey: ModelPresetKey;
  baseUrl: string;
  apiKey: string;
  models: DraftModel[];
} {
  return {
    name: '',
    presetKey: 'custom',
    baseUrl: '',
    apiKey: '',
    models: [{ name: '', type: 'llm', enabled: true, dimensions: '' }],
  };
}

export function ModelsWorkspace() {
  const { me } = useAdminAuth();
  const canManage = me.permissions.includes('model.gateway.manage');

  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [presets, setPresets] = useState<ModelProviderPreset[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [bindings, setBindings] = useState<PlatformBindings>({});
  const [bindDraft, setBindDraft] = useState<Partial<Record<BindingPurpose, string>>>({});
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(emptyDraft);

  const load = useCallback(async () => {
    if (!canManage) {
      setState('error');
      setError('无 model.gateway.manage 权限');
      return;
    }
    setState('loading');
    setError(null);
    const result = await loadModelGateway();
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setProviders(result.providers);
    setPresets(result.presets);
    setCatalog(result.catalog);
    setBindings(result.bindings);
    const nextBind: Partial<Record<BindingPurpose, string>> = {};
    for (const p of PLATFORM_BINDING_PURPOSES) {
      nextBind[p] = result.bindings[p]?.primary ?? '';
    }
    setBindDraft(nextBind);
    setState('ready');
  }, [canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const catalogByType = useMemo(() => {
    const map: Record<ModelType, ModelCatalogItem[]> = {
      llm: [],
      embedding: [],
      rerank: [],
    };
    for (const c of catalog) {
      map[c.type].push(c);
    }
    return map;
  }, [catalog]);

  function startCreate() {
    setEditingId(null);
    setDraft(emptyDraft());
    setFlash(null);
  }

  function startEdit(p: ModelProvider) {
    setEditingId(p.id);
    setDraft({
      name: p.name,
      presetKey: p.presetKey,
      baseUrl: p.baseUrl,
      apiKey: '',
      models: p.models.map((m) => ({
        name: m.name,
        type: m.type,
        enabled: m.enabled,
        dimensions: m.dimensions != null ? String(m.dimensions) : '',
      })),
    });
    setFlash(null);
  }

  function onPresetChange(key: ModelPresetKey) {
    const preset = presets.find((x) => x.key === key);
    setDraft((d) => ({
      ...d,
      presetKey: key,
      baseUrl: preset?.defaultBaseUrl || d.baseUrl,
    }));
  }

  async function onSubmitProvider(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFlash(null);
    setError(null);
    const models: ModelItem[] = draft.models
      .filter((m) => m.name.trim())
      .map((m) => ({
        name: m.name.trim(),
        type: m.type,
        enabled: m.enabled,
        ...(m.type === 'embedding' && m.dimensions
          ? { dimensions: Number(m.dimensions) }
          : {}),
      }));
    if (models.length === 0) {
      setError('至少配置一个模型');
      setBusy(false);
      return;
    }

    if (editingId) {
      const body = {
        name: draft.name.trim(),
        presetKey: draft.presetKey,
        baseUrl: draft.baseUrl.trim(),
        models,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
      };
      const r = await updateProvider(editingId, body);
      setBusy(false);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setFlash('供应商已更新');
    } else {
      const body = {
        name: draft.name.trim(),
        presetKey: draft.presetKey,
        baseUrl: draft.baseUrl.trim(),
        models,
        ...(draft.apiKey.trim() ? { apiKey: draft.apiKey.trim() } : {}),
      };
      const r = await createProvider(body);
      setBusy(false);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setFlash('供应商已创建');
      setEditingId(null);
      setDraft(emptyDraft());
    }
    await load();
  }

  async function onDelete(id: string) {
    if (!window.confirm('确认删除该供应商？')) return;
    setBusy(true);
    setError(null);
    const r = await removeProvider(id);
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setFlash('已删除');
    if (editingId === id) startCreate();
    await load();
  }

  async function onSaveBindings(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFlash(null);
    const next: PlatformBindings = {};
    for (const purpose of PLATFORM_BINDING_PURPOSES) {
      const primary = bindDraft[purpose]?.trim();
      if (primary) {
        next[purpose] = { primary };
      }
    }
    const r = await saveBindings({ bindings: next });
    setBusy(false);
    if (!r.ok) {
      setError(r.message);
      return;
    }
    setBindings(r.bindings);
    setFlash('平台绑定已保存');
  }

  if (!canManage) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">模型网关</h1>
        <p className="mt-2 text-sm text-muted-foreground">无 model.gateway.manage 权限（403）</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 p-6">
      <header>
        <h1 className="text-xl font-semibold">模型网关</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          供应商生产端 + 平台 purpose 绑定（Key 只写不回显）
        </p>
      </header>

      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}
      {flash ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">{flash}</p>
      ) : null}
      {state === 'loading' ? <p className="text-sm text-muted-foreground">加载中…</p> : null}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">供应商列表</h2>
            <Button type="button" variant="outline" size="sm" onClick={startCreate}>
              新建
            </Button>
          </div>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无供应商</p>
          ) : (
            <ul className="space-y-2">
              {providers.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.presetKey} · {p.models.length} 模型 ·{' '}
                      {p.hasApiKey ? '已配置 Key' : '无 Key'} ·{' '}
                      {p.enabled ? '启用' : '停用'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(p)}>
                      编辑
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => void onDelete(p.id)}
                    >
                      删除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form className="rounded-lg border border-border p-4 space-y-3" onSubmit={onSubmitProvider}>
          <h2 className="text-sm font-medium">{editingId ? '编辑供应商' : '新建供应商'}</h2>
          <div className="space-y-1">
            <Label htmlFor="preset">预设</Label>
            <select
              id="preset"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={draft.presetKey}
              onChange={(e) => onPresetChange(e.target.value as ModelPresetKey)}
            >
              {(presets.length > 0
                ? presets.map((p) => ({ key: p.key, label: p.label }))
                : ([
                    { key: 'deepseek' as const, label: 'DeepSeek' },
                    { key: 'ollama' as const, label: 'Ollama' },
                    { key: 'custom' as const, label: '自定义' },
                  ] as const)
              ).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="name">名称</Label>
            <Input
              id="name"
              required
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="baseUrl">请求地址</Label>
            <Input
              id="baseUrl"
              required
              value={draft.baseUrl}
              onChange={(e) => setDraft((d) => ({ ...d, baseUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="apiKey">API Key{editingId ? '（留空不改）' : ''}</Label>
            <Input
              id="apiKey"
              type="password"
              autoComplete="new-password"
              placeholder={editingId ? '••••••••' : ''}
              value={draft.apiKey}
              onChange={(e) => setDraft((d) => ({ ...d, apiKey: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>模型清单</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    models: [
                      ...d.models,
                      { name: '', type: 'llm', enabled: true, dimensions: '' },
                    ],
                  }))
                }
              >
                加行
              </Button>
            </div>
            {draft.models.map((m, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">名称</Label>
                  <Input
                    value={m.name}
                    onChange={(e) =>
                      setDraft((d) => {
                        const models = [...d.models];
                        models[idx] = { ...models[idx]!, name: e.target.value };
                        return { ...d, models };
                      })
                    }
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">类型</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                    value={m.type}
                    onChange={(e) =>
                      setDraft((d) => {
                        const models = [...d.models];
                        models[idx] = {
                          ...models[idx]!,
                          type: e.target.value as ModelType,
                        };
                        return { ...d, models };
                      })
                    }
                  >
                    {MODEL_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">启用</Label>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={m.enabled}
                    onChange={(e) =>
                      setDraft((d) => {
                        const models = [...d.models];
                        models[idx] = { ...models[idx]!, enabled: e.target.checked };
                        return { ...d, models };
                      })
                    }
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">dims</Label>
                  <Input
                    disabled={m.type !== 'embedding'}
                    value={m.dimensions}
                    onChange={(e) =>
                      setDraft((d) => {
                        const models = [...d.models];
                        models[idx] = { ...models[idx]!, dimensions: e.target.value };
                        return { ...d, models };
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>
          <Button type="submit" disabled={busy}>
            {editingId ? '保存供应商' : '创建供应商'}
          </Button>
        </form>
      </section>

      <section className="rounded-lg border border-border p-4">
        <h2 className="mb-3 text-sm font-medium">平台模型绑定</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={onSaveBindings}>
          {PLATFORM_BINDING_PURPOSES.map((purpose) => {
            const need =
              purpose === 'embed' ? 'embedding' : purpose === 'rerank' ? 'rerank' : 'llm';
            const options = catalogByType[need];
            return (
              <div key={purpose} className="space-y-1">
                <Label htmlFor={`bind-${purpose}`}>{purpose}</Label>
                <select
                  id={`bind-${purpose}`}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  value={bindDraft[purpose] ?? ''}
                  onChange={(e) =>
                    setBindDraft((d) => ({ ...d, [purpose]: e.target.value }))
                  }
                >
                  <option value="">（未绑定）</option>
                  {options.map((o) => (
                    <option key={o.ref} value={o.ref}>
                      {o.providerName} / {o.modelName}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
          <div className="md:col-span-2">
            <Button type="submit" disabled={busy}>
              保存平台绑定
            </Button>
            {Object.keys(bindings).length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                当前已绑 {Object.keys(bindings).length} 个 purpose
              </p>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
