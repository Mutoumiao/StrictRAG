'use client';

/**
 * 知识库设置薄页：基本信息 / 问答档位 / 质量只读 / rewrite 锁。
 * 禁止 τ 滑块与 rewrite 开关。
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { AskMode, KbSettings } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';

import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId } from '@/lib/kb-context';

import { loadKbSettings, saveKbSettings } from '../services';

const ALL_MODES: AskMode[] = ['strict', 'balanced', 'fast'];

export function SettingsWorkspace() {
  const { me } = useAdminAuth();
  const canWrite = me.permissions.includes('kb.config.write');

  const [kbId, setKbId] = useState('');
  const [settings, setSettings] = useState<KbSettings | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [allowedModes, setAllowedModes] = useState<AskMode[]>(['balanced']);
  const [defaultMode, setDefaultMode] = useState<AskMode>('balanced');
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
  }, []);

  const load = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setSettings(null);
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
    const result = await saveKbSettings(id, {
      name: name.trim(),
      description: description.trim() || null,
      allowedModes,
      defaultMode,
    });
    if (result.ok) {
      applySettings(result.settings);
      setFlash(result.text);
      setState('ready');
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
          KB：{kbId || '（请在顶栏填写 knowledge-base uuid）'}
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

      {!settings && state === 'idle' && !kbId && (
        <p className="text-sm text-muted-foreground">请先在顶栏填写 KB id 后刷新本页。</p>
      )}
    </div>
  );
}
