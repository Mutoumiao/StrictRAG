'use client';

/**
 * 最小运营壳：catalog 菜单裁剪 + KB 手填 + 退出。
 * 按钮可见 ≠ 授权；API 仍验码。
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { MENU_TREE, filterMenuByCodes } from '@strict-rag/admin-catalog';

import { adminLogoutLocal } from '@/auth/api';
import { useAdminAuth } from '@/components/auth-guard';
import { readStoredKbId, writeStoredKbId } from '@/lib/admin-api';

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
  const implemented = new Set(['/documents', '/approvals', '/members']);
  const links = menu.flatMap((g) =>
    (g.children ?? [])
      .filter((n) => n.href && implemented.has(n.href))
      .map((n) => ({ id: n.id, label: n.label, href: n.href! })),
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        fontFamily: 'system-ui, sans-serif',
        color: 'var(--sr-foreground)',
        background: 'var(--sr-background)',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px',
          borderBottom: '1px solid var(--sr-border, #e2e8f0)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
          <strong style={{ fontSize: 14 }}>StrictRAG Admin</strong>
          <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <Link
                  key={l.id}
                  href={l.href}
                  style={{
                    fontSize: 13,
                    textDecoration: 'none',
                    color: active ? 'var(--sr-foreground)' : 'var(--sr-muted, #64748b)',
                    fontWeight: active ? 600 : 400,
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--sr-muted, #64748b)' }}>
            KB
            <input
              value={kbId}
              onChange={(e) => {
                const v = e.target.value.trim();
                setKbId(v);
                writeStoredKbId(v);
              }}
              placeholder="knowledge-base uuid"
              style={{
                marginLeft: 6,
                width: 280,
                maxWidth: '40vw',
                padding: '4px 8px',
                fontSize: 12,
                borderRadius: 6,
                border: '1px solid var(--sr-border, #e2e8f0)',
              }}
            />
          </label>
          <span style={{ fontSize: 12, color: 'var(--sr-muted, #64748b)' }}>
            {me.email ?? me.userId}
          </span>
          <button
            type="button"
            onClick={() => {
              adminLogoutLocal();
              window.location.href = '/login';
            }}
            style={{ fontSize: 12, padding: '4px 10px' }}
          >
            退出
          </button>
        </div>
      </header>
      <main style={{ padding: '20px 24px', maxWidth: 960 }}>{children}</main>
    </div>
  );
}
