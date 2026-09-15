'use client';

/**
 * 分片策略设置弹窗：启用哪些 + 各 MIME 族 recommended + contextMode 单控件。不自动全库 reindex。
 */

import { useEffect, useState } from 'react';
import type { ChunkStrategyCatalogItem, ChunkStrategyDocFamily } from '@strict-rag/contracts';
import { CHUNK_STRATEGY_DOC_FAMILIES } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { ClosedSelect } from '@strict-rag/ui/components/ui/closed-select';
import { Label } from '@strict-rag/ui/components/ui/label';

import {
  effectiveContextMode,
  loadKbChunkStrategies,
  recommendedCodeByFamily,
  saveKbChunkStrategies,
  toPatchItems,
} from '../chunk-strategy.services';

const CONTEXT_MODE_OPTIONS = [
  { value: 'l1_llm', label: 'L1（默认；本轮入库回退 L0）' },
  { value: 'l0_template', label: 'L0 模板（召回增强关闭）' },
];

const FAMILY_LABEL: Record<ChunkStrategyDocFamily, string> = {
  md: 'md',
  txt: 'txt',
  docx: 'docx',
  pdf_text: 'pdf_text',
};

export function ChunkStrategyPanel({ kbId, canWrite }: { kbId: string; canWrite: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChunkStrategyCatalogItem[]>([]);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [recommended, setRecommended] = useState<Record<ChunkStrategyDocFamily, string>>(
    {} as Record<ChunkStrategyDocFamily, string>,
  );
  const [contextMode, setContextMode] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!kbId) return;
    let cancelled = false;
    void (async () => {
      const loaded = await loadKbChunkStrategies(kbId);
      if (cancelled) return;
      if (!loaded.ok) {
        setMessage(loaded.message);
        return;
      }
      setItems(loaded.items);
      setEnabled(Object.fromEntries(loaded.items.map((i) => [i.code, i.enabled])));
      setRecommended(recommendedCodeByFamily(loaded.items));
      setContextMode(
        Object.fromEntries(
          loaded.items.filter((i) => i.implemented).map((i) => [i.code, effectiveContextMode(i)]),
        ),
      );
      setMessage(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [kbId]);

  async function onSave() {
    setBusy(true);
    const result = await saveKbChunkStrategies(
      kbId,
      toPatchItems(items, enabled, recommended, contextMode),
    );
    setBusy(false);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setItems(result.items);
    setEnabled(Object.fromEntries(result.items.map((i) => [i.code, i.enabled])));
    setRecommended(recommendedCodeByFamily(result.items));
    setContextMode(
      Object.fromEntries(
        result.items.filter((i) => i.implemented).map((i) => [i.code, effectiveContextMode(i)]),
      ),
    );
    setMessage('已保存策略启用。不会自动 reindex 旧文档。');
  }

  const enabledCodes = items.filter((i) => enabled[i.code] && i.implemented).map((i) => i.code);
  const retrievalClosed = Object.values(contextMode).some((mode) => mode === 'l0_template');

  return (
    <section className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">分片策略</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canWrite || !kbId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? '收起' : '设置'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        改库启用不会自动全库 reindex。未实现码可列不可用于上传。
      </p>
      {retrievalClosed ? (
        <p className="text-xs font-medium">召回增强关闭</p>
      ) : null}
      {open ? (
        <div
          role="dialog"
          aria-label="分片策略设置"
          className="space-y-4 rounded-md border border-border bg-card p-3"
        >
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">启用</legend>
            {items.map((i) => (
              <label key={i.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(enabled[i.code])}
                  disabled={!canWrite || busy}
                  onChange={() =>
                    setEnabled((prev) => ({ ...prev, [i.code]: !prev[i.code] }))
                  }
                />
                <span className="font-mono">{i.code}</span>
                <span className="text-muted-foreground">{i.name}</span>
                {i.implemented ? null : (
                  <span className="text-xs text-muted-foreground">未实现</span>
                )}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-xs font-medium">各 MIME 族 recommended</legend>
            {CHUNK_STRATEGY_DOC_FAMILIES.map((family) => (
              <div key={family} className="flex items-center gap-2">
                <Label htmlFor={`rec-${family}`} className="w-20 text-xs">
                  {FAMILY_LABEL[family]}
                </Label>
                <select
                  id={`rec-${family}`}
                  className="flex h-9 w-full max-w-xs rounded-md border border-input bg-transparent px-3 text-sm"
                  value={recommended[family] ?? ''}
                  disabled={!canWrite || busy}
                  onChange={(e) =>
                    setRecommended((prev) => ({ ...prev, [family]: e.target.value }))
                  }
                >
                  <option value="">无</option>
                  {enabledCodes.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </fieldset>
          {items.some((i) => i.implemented) ? (
            <fieldset className="space-y-2">
              <legend className="text-xs font-medium">情境前缀</legend>
              {items
                .filter((i) => i.implemented)
                .map((i) => (
                  <div key={`ctx-${i.code}`} className="space-y-1.5">
                    <Label htmlFor={`context-mode-${i.code}`} className="text-xs font-mono">
                      {i.code}
                    </Label>
                    <ClosedSelect
                      id={`context-mode-${i.code}`}
                      aria-label={`情境前缀 ${i.code}`}
                      value={contextMode[i.code] ?? 'l1_llm'}
                      onValueChange={(value) =>
                        setContextMode((prev) => ({ ...prev, [i.code]: value }))
                      }
                      options={CONTEXT_MODE_OPTIONS}
                      disabled={!canWrite || busy}
                    />
                  </div>
                ))}
            </fieldset>
          ) : null}
          <Button type="button" size="sm" disabled={!canWrite || busy} onClick={() => void onSave()}>
            保存策略
          </Button>
          {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
