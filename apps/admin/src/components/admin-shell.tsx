'use client';

/**
 * 最小运营壳：catalog 菜单裁剪 + 当前 KB 关闭列表（本次 GET 可见库，禁止粘贴 uuid）+ 退出。
 * 按钮可见 ≠ 授权；API 仍验码。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { clipMenuForShell } from '@strict-rag/admin-catalog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@strict-rag/ui/components/ui/alert';
import { Button } from '@strict-rag/ui/components/ui/button';
import { ClosedSelect } from '@strict-rag/ui/components/ui/closed-select';
import { Label } from '@strict-rag/ui/components/ui/label';
import { cn } from '@strict-rag/ui/lib/utils';

import { logoutLocal } from '@/auth/services';
import { CreateKbControls } from '@/components/create-kb-controls';
import { useAdminAuth } from '@/components/auth-guard';
import { listKnowledgeBases } from '@/lib/kb-api';
import { readStoredKbId, writeStoredKbId } from '@/lib/kb-context';

type KbOption = { id: string; name: string };

function applyStoredKb(options: KbOption[]): string {
  const stored = readStoredKbId();
  if (options.some((row) => row.id === stored)) return stored;
  if (stored) writeStoredKbId('');
  return '';
}

export function AdminShell({ children }: { children: ReactNode }) {
  const { me } = useAdminAuth();
  const pathname = usePathname();
  const kbLabelId = useId();
  const [kbId, setKbId] = useState('');
  const [kbOptions, setKbOptions] = useState<KbOption[]>([]);
  const [kbListStatus, setKbListStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [kbReloadKey, setKbReloadKey] = useState(0);
  const optionsRef = useRef<KbOption[]>([]);
  const canCreateKb = me.permissions.includes('kb.create');
  optionsRef.current = kbOptions;

  useEffect(() => {
    let cancelled = false;
    setKbListStatus('loading');
    void listKnowledgeBases()
      .then((rows) => {
        if (cancelled) return;
        const fromApi = rows.map((r) => ({ id: r.id, name: r.name }));
        const fromApiIds = new Set(fromApi.map((r) => r.id));
        const extras = optionsRef.current.filter((row) => !fromApiIds.has(row.id));
        const merged = [...extras, ...fromApi];
        setKbOptions(merged);
        setKbId(applyStoredKb(merged));
        setKbListStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setKbOptions([]);
        setKbId('');
        setKbListStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [kbReloadKey]);

  // ponytail: 码裁剪 ∩ 已实现 href 全在 catalog；壳不再维护第二份白名单
  const links = useMemo(() => {
    const menu = clipMenuForShell(new Set(me.permissions));
    return menu.flatMap((g) =>
      (g.children ?? [])
        .filter((n) => n.href)
        .map((n) => ({ id: n.id, label: n.label, href: n.href! })),
    );
  }, [me.permissions]);

  function onSelectKb(id: string) {
    setKbId(id);
    writeStoredKbId(id);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex flex-wrap items-center gap-4">
          <strong className="text-sm">StrictRAG Admin</strong>
          <nav className="flex flex-wrap gap-2.5">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.id}
                  href={l.href}
                  className={cn(
                    'text-[13px] no-underline',
                    active ? 'font-semibold text-foreground' : 'font-normal text-muted-foreground',
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {kbListStatus === 'loading' ? (
            <p className="text-xs text-muted-foreground">正在加载知识库列表…</p>
          ) : null}
          {kbListStatus === 'error' ? (
            <Alert variant="destructive" className="flex items-center gap-2 p-2">
              <div>
                <AlertTitle className="m-0">知识库列表加载失败</AlertTitle>
                <AlertDescription className="mt-0.5 text-xs">无法获取可见知识库。</AlertDescription>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setKbReloadKey((n) => n + 1)}>
                重试
              </Button>
            </Alert>
          ) : null}
          {kbListStatus === 'ready' && kbOptions.length === 0 ? (
            <p className="text-xs text-muted-foreground">当前身份没有可见知识库</p>
          ) : null}
          {kbListStatus === 'ready' && kbOptions.length > 0 ? (
            <div className="flex items-center gap-1.5">
              <Label id={kbLabelId} className="text-xs font-normal text-muted-foreground">
                当前知识库
              </Label>
              <ClosedSelect
                aria-labelledby={kbLabelId}
                value={kbId}
                onValueChange={onSelectKb}
                options={kbOptions.map((row) => ({ value: row.id, label: row.name }))}
                placeholder="选择知识库"
                className="w-[220px] max-w-[40vw]"
              />
            </div>
          ) : null}
          {canCreateKb ? (
            <CreateKbControls
              defaultAdminUserId={me.userId}
              onCreated={(kb) => {
                setKbId(kb.id);
                writeStoredKbId(kb.id);
                setKbOptions((prev) =>
                  prev.some((row) => row.id === kb.id)
                    ? prev
                    : [{ id: kb.id, name: kb.name }, ...prev],
                );
                setKbListStatus('ready');
              }}
            />
          ) : null}
          <span className="text-xs text-muted-foreground">{me.email ?? me.userId}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              logoutLocal();
              window.location.href = '/login';
            }}
          >
            退出
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-[960px] px-6 py-5">
        {kbListStatus === 'loading' ? (
          <p className="text-sm text-muted-foreground">正在加载知识库列表…</p>
        ) : kbListStatus === 'error' ? null : (
          children
        )}
      </main>
    </div>
  );
}
