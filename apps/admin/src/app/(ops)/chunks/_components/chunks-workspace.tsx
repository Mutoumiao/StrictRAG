'use client';

/**
 * 分片只读薄页：选文档 → preview 列表 → 点击拉全文。
 * 禁止挂载时批量预拉 body。
 */

import { useCallback, useEffect, useState } from 'react';

import { useAdminAuth } from '@/components/auth-guard';
import type { ChunkDetail, ChunkListItem, DocumentListItem } from '@strict-rag/contracts';

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
        <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>分片</h1>
        <p style={{ fontSize: 14, color: '#b91c1c' }}>无 chunk.view 权限（403）</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>分片</h1>
        <button type="button" onClick={() => void loadDocs()} style={{ fontSize: 13 }}>
          刷新文档
        </button>
      </div>

      {!kbId ? (
        <p style={{ color: 'var(--sr-muted, #64748b)', fontSize: 14 }}>
          请在顶栏填写知识库 UUID 后刷新。
        </p>
      ) : null}

      {state === 'loading' ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>加载中…</p>
      ) : null}
      {state === 'error' ? (
        <p style={{ fontSize: 14, color: '#b91c1c' }}>{error}</p>
      ) : null}

      {kbId ? (
        <label style={{ display: 'block', fontSize: 13, marginBottom: 12 }}>
          文档
          <select
            value={docId}
            onChange={(e) => void onSelectDoc(e.target.value)}
            style={{ display: 'block', marginTop: 4, minWidth: 280, fontSize: 13, padding: 4 }}
          >
            <option value="">选择文档…</option>
            {docs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} · {d.status}/{d.lifecycle} · v{d.indexVersion}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {meta ? (
        <p style={{ fontSize: 12, color: 'var(--sr-muted, #64748b)', marginBottom: 8 }}>
          indexVersion={meta.indexVersion}
          {meta.status ? ` · status=${meta.status}` : ''}
          {meta.lifecycle ? ` · lifecycle=${meta.lifecycle}` : ''}
          {meta.status !== 'ready' || meta.lifecycle !== 'active'
            ? ' · 注意：非 ready+active 时不可当作已上线可问'
            : ''}
        </p>
      ) : null}

      {docId && state === 'ready' && items.length === 0 ? (
        <p style={{ fontSize: 14, color: 'var(--sr-muted, #64748b)' }}>
          当前激活版本无分片（未切块或 indexVersion=0）
        </p>
      ) : null}

      {items.length > 0 ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '8px 4px', width: 48 }}>#</th>
              <th style={{ padding: '8px 4px' }}>preview</th>
              <th style={{ padding: '8px 4px', width: 72 }}>tokens</th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.chunkId} style={{ borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' }}>
                <td style={{ padding: '8px 4px' }}>{r.ordinal}</td>
                <td style={{ padding: '8px 4px' }}>
                  <button
                    type="button"
                    onClick={() => void onOpenChunk(r.chunkId)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      textAlign: 'left',
                      cursor: 'pointer',
                      color: 'inherit',
                      font: 'inherit',
                    }}
                  >
                    {r.preview}
                    {r.previewTruncated ? '…' : ''}
                  </button>
                  {openId === r.chunkId ? (
                    <div
                      style={{
                        marginTop: 8,
                        padding: 10,
                        background: '#f8fafc',
                        borderRadius: 6,
                        whiteSpace: 'pre-wrap',
                        fontSize: 12,
                        lineHeight: 1.5,
                      }}
                    >
                      {detailBusy ? '加载全文…' : null}
                      {detailError ? (
                        <span style={{ color: '#b91c1c' }}>{detailError}</span>
                      ) : null}
                      {detail && detail.chunkId === r.chunkId ? (
                        <>
                          {detail.body}
                          {detail.bodyTruncated ? (
                            <div style={{ marginTop: 6, color: '#94a3b8' }}>
                              （已截断 · 软上限 64KiB）
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </td>
                <td style={{ padding: '8px 4px', color: '#94a3b8' }}>
                  {r.tokenCount ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void onLoadMore()}
          style={{ marginTop: 12, fontSize: 13 }}
        >
          加载更多
        </button>
      ) : null}
    </div>
  );
}
