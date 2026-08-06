'use client';

/**
 * 文档薄列表：status / approval / lifecycle。
 * 审批动作在 /approvals；此处只读刷新。
 */

import { useCallback, useEffect, useState } from 'react';
import type { DocumentListItem } from '@strict-rag/contracts';
import { Button } from '@strict-rag/ui/components/ui/button';
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

import { loadDocumentList } from '../list.services';

export function DocumentsWorkspace() {
  const { me } = useAdminAuth();
  const canView = me.permissions.includes('doc.view');
  const [rows, setRows] = useState<DocumentListItem[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'ready'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [kbId, setKbId] = useState('');

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
  }, [canView]);

  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [load]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="m-0 text-lg font-semibold">文档</h1>
        <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
          刷新
        </Button>
      </div>

      {!kbId ? (
        <p className="text-sm text-muted-foreground">请在顶栏填写知识库 UUID 后刷新。</p>
      ) : null}

      {state === 'loading' ? <p className="text-sm text-muted-foreground">加载中…</p> : null}
      {state === 'error' ? <p className="text-sm text-destructive">{error}</p> : null}
      {state === 'ready' && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无文档</p>
      ) : null}

      {rows.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow className="border-b-border">
              <TableHead>标题</TableHead>
              <TableHead>status</TableHead>
              <TableHead>approval</TableHead>
              <TableHead>lifecycle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div>{r.title}</div>
                  <div className="text-[11px] text-muted-foreground">{r.id}</div>
                </TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell>{r.approvalStatus}</TableCell>
                <TableCell>{r.lifecycle}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
    </div>
  );
}
