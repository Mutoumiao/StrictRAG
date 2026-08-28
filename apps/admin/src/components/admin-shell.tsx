'use client';

/**
 * 最小运营壳：catalog 菜单裁剪 + KB 下拉（可见库，仍可粘贴 uuid）+ 退出。
 * 按钮可见 ≠ 授权；API 仍验码。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clipMenuForShell } from '@strict-rag/admin-catalog';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { cn } from '@strict-rag/ui/lib/utils';

import { logoutLocal } from '@/auth/services';
import { CreateKbControls } from '@/components/create-kb-controls';
import { useAdminAuth } from '@/components/auth-guard';
import { listKnowledgeBases } from '@/lib/kb-api';
import { readStoredKbId, writeStoredKbId } from '@/lib/kb-context';

export function AdminShell({ children }: { children: ReactNode }) {
  const { me } = useAdminAuth();
  const pathname = usePathname();
  const [kbId, setKbId] = useState('');
  const [kbOptions, setKbOptions] = useState<{ id: string; name: string }[]>([]);
  const canCreateKb = me.permissions.includes('kb.create');

  useEffect(() => {
    setKbId(readStoredKbId());
    void listKnowledgeBases()
      .then((rows) => setKbOptions(rows.map((r) => ({ id: r.id, name: r.name }))))
      .catch(() => setKbOptions([]));
  }, []);

  // ponytail: 码裁剪 ∩ 已实现 href 全在 catalog；壳不再维护第二份白名单
  const links = useMemo(() => {
    const menu = clipMenuForShell(new Set(me.permissions));
    return menu.flatMap((g) =>
      (g.children ?? [])
        .filter((n) => n.href)
        .map((n) => ({ id: n.id, label: n.label, href: n.href! })),
    );
  }, [me.permissions]);

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
          <Label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
            KB
            <Input
              list="admin-kb-list"
              value={kbId}
              onChange={(e) => {
                const v = e.target.value.trim();
                setKbId(v);
                writeStoredKbId(v);
              }}
              placeholder="knowledge-base uuid"
              className="h-8 w-[280px] max-w-[40vw] text-xs"
            />
            <datalist id="admin-kb-list">
              {kbOptions.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </datalist>
          </Label>
          {canCreateKb ? (
            <CreateKbControls
              defaultAdminUserId={me.userId}
              onCreated={(kb) => {
                setKbId(kb.id);
                setKbOptions((prev) =>
                  prev.some((row) => row.id === kb.id)
                    ? prev
                    : [{ id: kb.id, name: kb.name }, ...prev],
                );
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
      <main className="mx-auto max-w-[960px] px-6 py-5">{children}</main>
    </div>
  );
}
