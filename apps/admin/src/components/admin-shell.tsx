'use client';

/**
 * 最小运营壳：catalog 菜单裁剪 + KB 手填 + 退出。
 * 按钮可见 ≠ 授权；API 仍验码。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MENU_TREE, filterMenuByCodes } from '@strict-rag/admin-catalog';
import { Button } from '@strict-rag/ui/components/ui/button';
import { Input } from '@strict-rag/ui/components/ui/input';
import { Label } from '@strict-rag/ui/components/ui/label';
import { cn } from '@strict-rag/ui/lib/utils';

import { logoutLocal } from '@/auth/services';
import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId, writeStoredKbId } from '@/lib/kb-context';

export function AdminShell({ children }: { children: ReactNode }) {
  const { me } = useAdminAuth();
  const pathname = usePathname();
  const [kbId, setKbId] = useState('');

  useEffect(() => {
    setKbId(readStoredKbId());
  }, []);

  const menu = useMemo(() => {
    const codes = new Set(me.permissions);
    return filterMenuByCodes(MENU_TREE, codes);
  }, [me.permissions]);

  // ponytail: catalog 仍是 SSOT；仅展示本切片已落地的 href，避免 404 菜单
  const implemented = new Set([
    '/documents',
    '/approvals',
    '/members',
    '/chunks',
    '/kb/settings',
  ]);
  const links = menu.flatMap((g) =>
    (g.children ?? [])
      .filter((n) => n.href && implemented.has(n.href))
      .map((n) => ({ id: n.id, label: n.label, href: n.href! })),
  );

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
              value={kbId}
              onChange={(e) => {
                const v = e.target.value.trim();
                setKbId(v);
                writeStoredKbId(v);
              }}
              placeholder="knowledge-base uuid"
              className="h-8 w-[280px] max-w-[40vw] text-xs"
            />
          </Label>
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
