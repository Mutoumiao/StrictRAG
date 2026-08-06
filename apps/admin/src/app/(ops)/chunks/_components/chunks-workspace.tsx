'use client';

/**
 * 分片只读薄页：选文档 → preview 列表 → 点击拉全文。
 * 禁止挂载时批量预拉 body。
 */

import { useCallback, useEffect, useState } from 'react';
import type { ChunkDetail, ChunkListItem, DocumentListItem } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Label } from '@strict-rag/ui/components/ui/label';
import { Select } from '@strict-rag/ui/components/ui/select';
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

import { loadChunkBody, loadChunkDocs, loadChunkList } from '../services';

export function ChunksWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('chunk.view');

  const [kbId, setKbId] = useState('');
  const [docs, setDocs] = useState<DocumentListItem[]>([]);
  const [docId, setDocId] = useState('');
  const [items, setItems] = useState<ChunkListItem[]>([]);
  const [meta, setMeta] = useState<{
    indexVersion: number;
    status?: string;
    lifecycle?: string;
  } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChunkDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadDocs = useCallback(async () => {
    const id = readStoredKbId().trim();
    setKbId(id);
    if (!id) {
      setDocs([]);
      setState('idle');
      setError(null);
      return;
    }
    if (!canView) {
      setState('error');
      setError('无 chunk.view 权限');
      return;
    }
    setState('loading');
    setError(null);
    const result = await loadChunkDocs(id);
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setDocs(result.rows);
    setState('ready');
  }, [canView]);

  useEffect(() => {
    void loadDocs();
  }, [loadDocs]);

  async function onSelectDoc(id: string) {
    setDocId(id);
    setOpenId(null);
    setDetail(null);
    setDetailError(null);
    setItems([]);
    setMeta(null);
    setNextCursor(null);
    if (!id) return;
    setState('loading');
    setError(null);
    const result = await loadChunkList(id, { limit: 50 });
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setItems(result.items);
    setMeta({
      indexVersion: result.indexVersion,
      status: result.status,
      lifecycle: result.lifecycle,
    });
    setNextCursor(result.nextCursor);
    setState('ready');
  }

  async function onLoadMore() {
    if (!docId || !nextCursor) return;
    setState('loading');
    const result = await loadChunkList(docId, { limit: 50, cursor: nextCursor });
    if (!result.ok) {
      setState('error');
      setError(result.message);
      return;
    }
    setItems((prev) => [...prev, ...result.items]);
    setNextCursor(result.nextCursor);
    setState('ready');
  }

  async function onOpenChunk(chunkId: string) {
    if (!docId) return;
    if (openId === chunkId) {
      setOpenId(null);
      setDetail(null);
      setDetailError(null);
      return;
    }
    setOpenId(chunkId);
    setDetail(null);
    setDetailError(null);
    setDetailBusy(true);
    const result = await loadChunkBody(docId, chunkId);
    setDetailBusy(false);
    if (!result.ok) {
      setDetailError(result.message);
      return;
    }
    setDetail(result.detail);
  }

  if (!canView) {
    return (
      <div>
        <h1 className="mb-3 text-lg font-semibold">分片</h1>
        <p className="text-sm text-destructive">无 chunk.view 权限（403）</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">分片</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadDocs()}>
          刷新文档
        </Button>
      </div>

      {!kbId ? (
        <p className="text-sm text-muted-foreground">请在顶栏填写知识库 UUID 后刷新。</p>
      ) : null}

      {state === 'loading' ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {state === 'error' ? <p className="text-sm text-destructive">{error}</p> : null}

      {kbId ? (
        <div className="mb-3 space-y-1">
          <Label htmlFor="chunk-doc">文档</Label>
          <Select
            id="chunk-doc"
            value={docId}
            onChange={(e) => void onSelectDoc(e.target.value)}
            className="min-w-[280px] w-auto"
          >
            <option value="">选择文档…</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {d.status}/{d.lifecycle} · v{d.indexVersion}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      {meta ? (
        <p className="mb-2 text-xs text-muted-foreground">
          indexVersion={meta.indexVersion}
          {meta.status ? ` · status=${meta.status}` : ''}
          {meta.lifecycle ? ` · lifecycle=${meta.lifecycle}` : ''}
          {meta.status !== 'ready' || meta.lifecycle !== 'active'
            ? ' · 注意：非 ready+active 时不可当作已上线可问'
            : ''}
        </p>
      ) : null}

      {docId && state === 'ready' && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          当前激活版本无分片（未切块或 indexVersion=0）
        </p>
      ) : null}

      {items.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-b-border">
              <TableHead className="w-12">#</TableHead>
              <TableHead>preview</TableHead>
              <TableHead className="w-[72px]">tokens</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.chunkId} className="align-top">
                <TableCell>{r.ordinal}</TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => void onOpenChunk(r.chunkId)}
                    className="cursor-pointer border-0 bg-transparent p-0 text-left font-inherit text-inherit"
                  >
                    {r.preview}
                    {r.previewTruncated ? '…' : ''}
                  </button>
                  {openId === r.chunkId ? (
                    <div className="mt-2 whitespace-pre-wrap rounded-md bg-muted p-2.5 text-xs leading-relaxed">
                      {detailBusy ? '加载全文…' : null}
                      {detailError ? (
                        <span className="text-destructive">{detailError}</span>
                      ) : null}
                      {detail && detail.chunkId === r.chunkId ? (
                        <>
                          {detail.body}
                          {detail.bodyTruncated ? (
                            <div className="mt-1.5 text-muted-foreground">
                              （已截断 · 软上限 64KiB）
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="text-muted-foreground">{r.tokenCount ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}

      {nextCursor ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => void onLoadMore()}
        >
          加载更多
        </Button>
      ) : null}
    </div>
  );
}
